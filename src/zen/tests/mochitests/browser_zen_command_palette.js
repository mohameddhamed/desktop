/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Mochitest suite for Zen Browser Native VS Code-style Command Palette
 * Covers lifecycle, caret positioning, fuzzy search, Quick Open MRU tabs fallback,
 * re-entry, execution, and dismissal.
 */
add_task(async function test_command_palette_lifecycle() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.urlbar.suggest.quickactions", true],
      ["zen.urlbar.suggestions.quick-actions", true],
      ["zen.urlbar.actions.enabled", true],
      ["browser.urlbar.suggest.openpage", true],
    ],
  });

  // Open an extra tab so we have open tabs for MRU verification
  let testTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/"
  );

  // 1. Synthesize shortcut activation (Cmd + Shift + P)
  EventUtils.synthesizeKey("P", { accelKey: true, shiftKey: true });
  await TestUtils.waitForCondition(() => gURLBar.hasAttribute("breakout-extend"));

  Assert.ok(gURLBar.hasAttribute("breakout-extend"), "URL bar is opened and expanded");
  Assert.ok(gURLBar.hasAttribute("zen-command-palette"), "Command palette attribute set");
  Assert.equal(gURLBar.value, ">", "URL bar pre-filled with restriction character '>'");
  Assert.equal(gURLBar.selectionStart, 1, "Caret placed immediately after '>' at index 1");
  Assert.equal(gURLBar.selectionEnd, 1, "No selection range active (avoids selection wipe)");

  // 2. Verify command catalog lists actions
  await UrlbarTestUtils.promiseSearchComplete(window);
  let resultCount = UrlbarTestUtils.getResultCount(window);
  Assert.greater(resultCount, 0, "Command actions populated");

  let firstResult = await UrlbarTestUtils.getDetailsOfResultAtIndex(window, 0);
  Assert.equal(firstResult.type, UrlbarUtils.RESULT_TYPE.DYNAMIC, "Result is dynamic action");
  Assert.equal(firstResult.payload.dynamicType, "zen-actions", "Action type is zen-actions");

  // 3. Test Fuzzy Matching with user keywords
  EventUtils.sendString("split");
  await UrlbarTestUtils.promiseSearchComplete(window);
  let splitResult = await UrlbarTestUtils.getDetailsOfResultAtIndex(window, 0);
  Assert.ok(
    splitResult.payload.title.toLowerCase().includes("split"),
    "Fuzzy matched split action: " + splitResult.payload.title
  );

  // 4. Test Dynamic Switch on Backspace (Quick Open MRU tabs transition)
  while (gURLBar.value.length > 0) {
    EventUtils.synthesizeKey("KEY_Backspace");
  }
  await UrlbarTestUtils.promiseSearchComplete(window);
  Assert.equal(gURLBar.value, "", "Input completely cleared to empty");
  Assert.ok(gURLBar.hasAttribute("breakout-extend"), "URL bar remains open on empty input");

  let mruCount = UrlbarTestUtils.getResultCount(window);
  Assert.greater(mruCount, 0, "MRU open tabs populated on empty prompt");
  let firstMruResult = await UrlbarTestUtils.getDetailsOfResultAtIndex(window, 0);
  Assert.equal(
    firstMruResult.type,
    UrlbarUtils.RESULT_TYPE.TAB_SWITCH,
    "MRU result is TAB_SWITCH type"
  );

  // 5. Test Command Mode Re-entry
  EventUtils.sendString(">");
  await UrlbarTestUtils.promiseSearchComplete(window);
  let reenteredResult = await UrlbarTestUtils.getDetailsOfResultAtIndex(window, 0);
  Assert.equal(reenteredResult.payload.dynamicType, "zen-actions", "Re-entered command mode");

  // 6. Test Query with leading space (e.g. "> theme")
  EventUtils.sendString(" theme");
  await UrlbarTestUtils.promiseSearchComplete(window);
  let themeResult = await UrlbarTestUtils.getDetailsOfResultAtIndex(window, 0);
  Assert.ok(
    themeResult.payload.title.toLowerCase().includes("theme"),
    "Stripped '>' prefix and fuzzy matched 'theme': " + themeResult.payload.title
  );

  // 7. Test Command Execution
  EventUtils.synthesizeKey("KEY_ArrowDown");
  EventUtils.synthesizeKey("KEY_Enter");
  await TestUtils.waitForCondition(() => !gURLBar.hasAttribute("breakout-extend"));
  Assert.ok(!gURLBar.hasAttribute("breakout-extend"), "URL bar closed after command execution");
  Assert.ok(!gURLBar.hasAttribute("zen-command-palette"), "Command palette attribute cleaned up");

  // 8. Test Escape key dismissal
  EventUtils.synthesizeKey("P", { accelKey: true, shiftKey: true });
  await TestUtils.waitForCondition(() => gURLBar.hasAttribute("breakout-extend"));
  Assert.ok(gURLBar.hasAttribute("breakout-extend"), "Command palette reopened");

  EventUtils.synthesizeKey("KEY_Escape");
  await TestUtils.waitForCondition(() => !gURLBar.hasAttribute("breakout-extend"));
  Assert.ok(!gURLBar.hasAttribute("breakout-extend"), "URL bar closed after Escape");
  Assert.ok(!gURLBar.hasAttribute("zen-command-palette"), "Command palette cleaned up on Escape");

  // Cleanup test tab
  BrowserTestUtils.removeTab(testTab);
});
