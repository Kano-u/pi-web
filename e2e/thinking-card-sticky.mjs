import assert from "node:assert/strict";

/**
 * A tall expanded thinking card shares the pinned-card mechanism with tool-call
 * cards: its title bar sticks 8px below the top of the message list and folding
 * its reasoning body away leaves the header where it was pinned.
 *
 * The session's thinking block renders inside the collapsed "Process details"
 * disclosure of a message that has a final answer of its own, so that is opened
 * first. The window's `pi-thinking-expanded` preference is set before navigation
 * by the caller.
 */
export async function checkThinkingCardSticky(page, viewport) {
  await page.setViewportSize(viewport);
  const processDetails = page.getByRole("button", { name: /^Process details/ });
  await processDetails.waitFor({ state: "visible" });
  await processDetails.click();

  const card = page.locator(".thinking-card");
  const toggle = card.locator(".pin-card-header button");
  await card.waitFor({ state: "visible" });
  // The stored preference seeds the initial state, but open it explicitly if the
  // render came up collapsed for any reason.
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  // Opening is that same animation run backwards now, so the pane keeps an inline
  // height until the unfold settles; the normal path here mounts the card open.
  await page.waitForFunction(() => {
    const pane = document.querySelector(".thinking-card [data-pin-pane]");
    return !!pane && !pane.style.height;
  });
  await card.locator("[data-pin-pane]").waitFor({ state: "visible" });
  // Thinking bodies are deferred and fetched on expand; wait for the tail of the
  // fixture so the pane is at its full height before it is measured.
  await card.getByText("E2E reasoning line 220", { exact: false }).waitFor({ state: "attached" });
  assert.equal(await card.count(), 1, "The fixture renders exactly one thinking card");

  const measure = () => card.evaluate((element) => {
    const list = element.closest(".overflow-y-auto");
    const bar = element.querySelector(".pin-card-header");
    const pane = element.querySelector("[data-pin-pane]");
    const box = (node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    };
    return {
      list: { ...box(list), scrollTop: list.scrollTop },
      card: box(element),
      bar: box(bar),
      pane: pane ? box(pane) : null,
    };
  });

  const open = await measure();
  assert.ok(open.pane, "An expanded thinking card renders its pane");
  assert.ok(open.pane.height <= 561, "A long reasoning chain is capped so the card scrolls inside");

  // Scroll the card's own top 300px above the list, which pins its header.
  await card.evaluate((element) => {
    const list = element.closest(".overflow-y-auto");
    list.scrollTop += element.getBoundingClientRect().top - list.getBoundingClientRect().top + 300;
  });
  const pinned = await measure();
  assert.ok(
    Math.abs((pinned.bar.top - pinned.list.top) - 8) < 0.6,
    `The thinking header pins 8px below the list top, not ${pinned.bar.top - pinned.list.top}`,
  );

  const before = pinned.list.scrollTop;
  await toggle.click();
  await page.waitForFunction(() => document.querySelectorAll(".thinking-card [data-pin-pane]").length === 0);
  const folded = await measure();

  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(folded.pane, null, "The reasoning body unmounts once the fold has finished");
  assert.ok(
    Math.abs((folded.bar.top - folded.list.top) - 8) < 1.5,
    `Folding must leave the thinking header where it was pinned, not at ${folded.bar.top - folded.list.top}`,
  );
  assert.ok(folded.list.scrollTop < before - 100, "The list has to come back by the height the card gave up");
  assert.ok(Math.abs(folded.card.height - folded.bar.height) < 1, "A folded thinking card is nothing but its header");

  console.log("PASS: pinned thinking-card header and fold that keeps it in place");
}
