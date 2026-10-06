import assert from "node:assert/strict";

/**
 * A tall expanded tool card pins its header to the top of the message list with
 * 8px of page background above it, paints nothing from the pane scrolling under
 * it into that room, and folds away with the list coming back by exactly the
 * height the card gave up — the header stays where it was pinned. Opening a card is
 * that same animation run backwards, and it is sampled frame by frame below.
 *
 * The card's own box clips nothing, so the header's sticky containing block stays
 * the message list.
 */
/**
 * Samples the pane's height every frame until the unfold settles.
 *
 * The unfold clears the pane's inline height as its last act, and a card that opens
 * instantly (reduced motion, or a card that is already open) never writes one at
 * all, so an empty inline height is what says the height in hand is the final one.
 */
function sampleUnfold() {
  return new Promise((resolve) => {
    const started = performance.now();
    const samples = [];
    const tick = () => {
      const pane = document.querySelector("[data-pin-pane]");
      if (pane) samples.push({ height: pane.getBoundingClientRect().height, at: performance.now() });
      if ((pane && !pane.style.height) || performance.now() - started > 2000) {
        resolve(samples);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

/**
 * An unfold ends by clearing the pane's inline height, which is when it is done. The
 * pane may also be absent — before the commit that mounts it, or after the fold that
 * removed it — so absence is not "done".
 */
const waitForUnfold = (page) =>
  page.waitForFunction(() => {
    const pane = document.querySelector("[data-pin-pane]");
    return !!pane && !pane.style.height;
  });

export async function checkToolCardSticky(page, viewport) {
  // checkChatAppearance leaves the window wherever its own viewport loop ended.
  await page.setViewportSize(viewport);
  const card = page.locator(".tool-card");
  const header = page.getByRole("button", { name: /^bash/ });

  const processDetails = page.getByRole("button", { name: /^Process details/ });
  // The session render is a client fetch, and the tool call then sits inside the
  // collapsed process disclosure of a message that has an answer of its own.
  await processDetails.waitFor({ state: "visible" });
  await processDetails.click();
  await header.waitFor({ state: "visible" });
  assert.equal(await card.count(), 1, "The fixture renders exactly one tool card");
  assert.equal(await header.getAttribute("aria-expanded"), "false");

  /** Everything the assertions need, measured against the message list itself. */
  const measure = () => card.evaluate((element) => {
    const list = element.closest(".overflow-y-auto");
    const bar = element.querySelector(".pin-card-header");
    const pane = element.querySelector("[data-pin-pane]");
    const box = (node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height };
    };
    return {
      list: { ...box(list), scrollTop: list.scrollTop, width: list.clientWidth, height: list.clientHeight },
      card: box(element),
      bar: bar ? box(bar) : null,
      pane: pane ? box(pane) : null,
    };
  });

  // Scrolling the card's own top 500px above the list pins its header.
  const pin = (delta) => card.evaluate((element, offset) => {
    const list = element.closest(".overflow-y-auto");
    list.scrollTop += element.getBoundingClientRect().top - list.getBoundingClientRect().top + offset;
  }, delta);

  // The unfold is an animation: sample the pane every frame, from before the click
  // until it settles, and check the steps it took.
  const unfolding = page.evaluate(sampleUnfold);
  await header.click();
  await page.locator("[data-pin-pane]").first().waitFor({ state: "visible" });
  const samples = await unfolding;
  assert.ok(samples.length >= 5, `The unfold has to run over frames, not in one: ${samples.length} samples`);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(
      samples[index].height >= samples[index - 1].height - 0.5,
      `The pane has to grow, not shrink: ${samples[index - 1].height} -> ${samples[index].height}`
    );
  }
  const deltas = samples.slice(1).map((sample, index) => sample.height - samples[index].height);
  const third = Math.max(1, Math.floor(deltas.length / 3));
  const fastestEarly = Math.max(...deltas.slice(0, third));
  const fastestLate = Math.max(...deltas.slice(-third));
  const unfoldedMs = samples[samples.length - 1].at - samples[0].at;
  assert.ok(
    unfoldedMs > 120 && unfoldedMs < 700,
    `The unfold has to be one quick pop, not ${Math.round(unfoldedMs)}ms`
  );
  assert.ok(
    fastestEarly > fastestLate + 1,
    `The unfold has to ease out, not run at one speed: ${fastestEarly}px per frame early, ${fastestLate}px late`
  );

  const open = await measure();
  assert.ok(open.pane, "An expanded card renders its pane");
  assert.ok(open.bar);
  assert.ok(
    Math.abs(samples[samples.length - 1].height - open.pane.height) < 1,
    `The unfold has to settle at the pane's own height: ${samples[samples.length - 1].height} for ${open.pane.height}`
  );
  assert.ok(open.pane.height > open.list.height, "The pane has to outgrow the viewport to pin the header");
  assert.ok(open.pane.top >= open.bar.bottom - 1, "At rest the pane starts right below the header");

  await pin(500);
  const pinned = await measure();
  assert.ok(Math.abs((pinned.bar.top - pinned.list.top) - 8) < 0.6, `The header pins 8px below the list top, not ${pinned.bar.top - pinned.list.top}`);
  assert.ok(pinned.pane.top < pinned.list.top, "The pane scrolls above the pinned header");
  assert.ok(pinned.pane.bottom > pinned.list.top + 14, "The pane runs through the room the header leaves above itself");

  // That room is page background, and it is the band — not the header — that covers
  // it: the header's own opaque fill stops 8px lower, and its rounded corners leave
  // the corners of that fill behind too. A reader must see neither the pane nor the
  // card's own tint there, so the room is sampled and hit-tested. First, the pixels.
  const left = Math.round(pinned.card.left - pinned.list.left);
  const width = Math.round(pinned.card.right - pinned.card.left);
  const shot = await page.screenshot({
    clip: {
      x: pinned.list.left,
      y: pinned.list.top,
      width: pinned.list.width,
      height: pinned.list.height,
    },
  });
  const room = await page.evaluate(async ([base64, geometry]) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const background = getComputedStyle(document.body).backgroundColor;
    const colors = [];
    for (const y of [2, 4, 6]) {
      for (const fraction of [0.05, 0.25, 0.5, 0.75, 0.95]) {
        const x = Math.round(geometry.left + geometry.width * fraction);
        const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
        colors.push({ x, y, color: `rgb(${red}, ${green}, ${blue})` });
      }
    }
    // Hit-testing is the part that covers the corners: whatever is on top there
    // receives the pointer. Below the header the pane must be, or the probe proves
    // nothing.
    const top = Math.round(geometry.bar.top - geometry.list.top);
    const points = [];
    for (const y of [2, 4, 6]) {
      for (const fraction of [0.05, 0.5, 0.95]) {
        points.push({ x: Math.round(geometry.left + geometry.width * fraction), y });
      }
    }
    for (const [dx, dy] of [[1, 1], [1, 2], [2, 1]]) {
      points.push({ x: geometry.left + dx, y: top + dy });
      points.push({ x: geometry.left + geometry.width - 1 - dx, y: top + dy });
    }
    const asPane = (point) => !!document
      .elementFromPoint(geometry.list.left + point.x, geometry.list.top + point.y)
      ?.closest("[data-pin-pane]");
    return {
      background,
      colors,
      covered: points.filter((point) => asPane(point)).map((point) => `${point.x},${point.y}`),
      reachesPane: asPane({ x: Math.round(geometry.width / 2), y: top + 60 }),
    };
  }, [shot.toString("base64"), { ...pinned, left, width }]);
  const expected = room.background.match(/\d+/g).slice(0, 3).map(Number);
  const channel = (color) => color.match(/\d+/g).slice(0, 3).map(Number);
  for (const sample of room.colors) {
    const actual = channel(sample.color);
    assert.ok(
      actual.every((value, index) => Math.abs(value - expected[index]) <= 2),
      `Nothing may paint at ${sample.x},${sample.y}: ${sample.color} is not ${room.background}`
    );
  }
  assert.equal(room.reachesPane, true, "The probe must reach the pane below the header");
  assert.deepEqual(room.covered, [], "The pane must not cover the room above the pinned header");

  const before = pinned.list.scrollTop;
  await header.click();
  await page.waitForFunction(() => document.querySelectorAll("[data-pin-pane]").length === 0);
  const folded = await measure();

  assert.equal(await header.getAttribute("aria-expanded"), "false");
  assert.equal(folded.pane, null, "The panes unmount once the fold has finished");
  assert.ok(
    Math.abs((folded.bar.top - folded.list.top) - 8) < 1.5,
    `Folding must leave the header where it was pinned, not at ${folded.bar.top - folded.list.top}`
      + ` (before ${before}, after ${folded.list.scrollTop}, card ${folded.card.top - folded.list.top})`,
  );
  assert.ok(folded.list.scrollTop < before - 100, "The list has to come back by the height the card gave up");
  assert.ok(Math.abs(folded.card.height - folded.bar.height) < 1, "A folded card is nothing but its header");

  // Reduced motion drops the animation but not the compensating scroll: that is what
  // keeps the header on screen, not an animation nicety.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const instant = page.evaluate(sampleUnfold);
  await header.click();
  await page.locator("[data-pin-pane]").first().waitFor({ state: "visible" });
  // Reduced motion leaves no frames to animate: the sampler catches the card open.
  const instantSamples = await instant;
  assert.equal(instantSamples.length, 1, `Reduced motion must open the card at once: ${instantSamples.length} samples`);
  await pin(500);
  await header.click();
  await page.waitForFunction(() => document.querySelectorAll("[data-pin-pane]").length === 0);
  const reduced = await measure();
  assert.ok(
    Math.abs((reduced.bar.top - reduced.list.top) - 8) < 1.5,
    `Reduced motion must land the header in place too, not at ${reduced.bar.top - reduced.list.top}`,
  );
  await page.emulateMedia({ reducedMotion: null });

  // Opening, then folding and reopening within the fold must leave the card at its
  // own height: the fold's finish and the reopen batch into one render, so panes
  // still carrying the height the fold had reached would stay folded behind a
  // chevron that says otherwise.
  await header.click();
  await page.locator("[data-pin-pane]").first().waitFor({ state: "visible" });
  const box = await header.boundingBox();
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.click(middle.x, middle.y);
  await page.mouse.click(middle.x, middle.y);
  // Unreachable if the card came back folded behind an expanded chevron.
  await page.waitForFunction(() => {
    const pane = document.querySelector("[data-pin-pane]");
    const bar = document.querySelector(".pin-card-header button");
    return bar?.getAttribute("aria-expanded") === "true" && !!pane && pane.getBoundingClientRect().height > 100;
  });
  // That predicate is satisfied mid-animation; the height it reads has to be the one
  // the unfold settles on.
  await waitForUnfold(page);
  const reopened = await measure();
  assert.ok(
    Math.abs(reopened.pane.height - open.pane.height) < 2,
    `A card reopened mid-fold must be its own height again: ${reopened.pane.height} for ${open.pane.height}`,
  );

  // A card scrolled completely above the list folds itself away, and the list
  // gives back the height the panes gave up, so the message under the card keeps
  // its place on screen. Scrolling all the way clears the sticky header too.
  const offscreen = await card.evaluate((element) => {
    const list = element.closest(".overflow-y-auto");
    list.scrollTop += element.getBoundingClientRect().bottom - list.getBoundingClientRect().top + 40;
    const tail = document.querySelector('[data-entry-id="tail"]');
    return {
      listTop: list.getBoundingClientRect().top,
      cardBottom: element.getBoundingClientRect().bottom,
      scrollTop: list.scrollTop,
      paneHeight: [...element.querySelectorAll("[data-pin-pane]")]
        .reduce((sum, pane) => sum + pane.getBoundingClientRect().height, 0),
      tailTop: tail ? tail.getBoundingClientRect().top : null,
    };
  });
  assert.ok(offscreen.paneHeight > 0, "The card has to be expanded before it leaves the viewport");
  assert.ok(offscreen.cardBottom < offscreen.listTop, "The card has to sit completely above the list");
  assert.ok(offscreen.tailTop !== null, "The fixture renders the trailing message");

  await page.waitForFunction(() => document.querySelectorAll(".tool-card [data-pin-pane]").length === 0);
  assert.equal(await header.getAttribute("aria-expanded"), "false", "A card scrolled above the list folds itself away");

  const settled = await card.evaluate((element) => {
    const list = element.closest(".overflow-y-auto");
    const tail = document.querySelector('[data-entry-id="tail"]');
    return {
      scrollTop: list.scrollTop,
      tailTop: tail ? tail.getBoundingClientRect().top : null,
    };
  });
  assert.ok(
    Math.abs(settled.tailTop - offscreen.tailTop) < 3,
    `Auto-collapse must not move the message below the card: ${settled.tailTop} for ${offscreen.tailTop}`,
  );
  assert.ok(
    Math.abs(offscreen.scrollTop - offscreen.paneHeight - settled.scrollTop) < 3,
    `The list has to come back by the pane height: ${offscreen.scrollTop} -> ${settled.scrollTop}, pane ${offscreen.paneHeight}`,
  );
  console.log("PASS: pinned tool-card header, covered gap, fold, and the auto-collapse off screen");
}
