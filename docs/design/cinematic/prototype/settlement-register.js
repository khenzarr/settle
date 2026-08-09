(function () {
  'use strict';

  var narrative = 7.2;
  var rest = 4.8;
  var cycle = narrative + rest;
  var beats = [
    [0, '00', 'QUIET REGISTER'], [0.55, '01', 'ORDER SIGNAL'],
    [1.3, '02', 'PAYMENT INTENT'], [2.15, '03', 'BUYER COMMIT'],
    [3.05, '04', 'ESCROW · HOLD'], [4.15, '05', 'PROGRAM RESOLVES'],
    [5.05, '06', 'DETERMINISTIC DISTRIBUTION'], [6.3, '07', 'CANONICAL ALIGNMENT'],
    [7.2, '08', 'MEANINGFUL REST']
  ];
  var stages = Array.prototype.slice.call(document.querySelectorAll('.stage'));
  var progress = document.querySelector('.timeline-progress');
  var beatNumber = document.querySelector('.beat-number');
  var beatName = document.querySelector('.beat-name');
  var beatTime = document.querySelector('.beat-time');
  var pauseButton = document.querySelector('[data-action="pause"]');
  var reduced = false;
  var playing = false;
  var startedAt = 0;
  var elapsed = cycle;
  var raf;
  var playbackRate = 1;

  function state(value) { stages.forEach(function (stage) { stage.dataset.state = value; }); }
  function syncAnimations() {
    stages.forEach(function (stage) {
      stage.getAnimations().forEach(function (animation) {
        animation.currentTime = elapsed * 1000;
        animation.playbackRate = playbackRate;
        animation.play();
      });
    });
  }
  function update(now) {
    if (!playing) return;
    elapsed = ((now - startedAt) / 1000) % cycle;
    var current = beats[0];
    beats.forEach(function (beat) { if (elapsed >= beat[0]) current = beat; });
    progress.style.width = (elapsed / cycle * 100).toFixed(2) + '%';
    beatNumber.textContent = current[1];
    beatName.textContent = current[2];
    beatTime.textContent = elapsed.toFixed(2) + 's / ' + cycle.toFixed(2) + 's';
    raf = requestAnimationFrame(update);
  }
  function play(fromStart) {
    if (reduced) return;
    if (fromStart) elapsed = 0;
    startedAt = performance.now() - elapsed * 1000;
    playing = true;
    pauseButton.textContent = 'Pause';
    state('playing');
    requestAnimationFrame(syncAnimations);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    stages.forEach(function (stage) { stage.getAnimations().forEach(function (animation) { animation.pause(); }); });
    pauseButton.textContent = 'Resume';
  }
  document.querySelector('[data-action="play"]').addEventListener('click', function () { play(true); });
  document.querySelector('[data-action="pause"]').addEventListener('click', function () { playing ? pause() : play(false); });
  document.querySelector('[data-action="reduced"]').addEventListener('click', function (event) {
    reduced = !reduced;
    event.currentTarget.setAttribute('aria-pressed', String(reduced));
    if (reduced) { pause(); state('poster'); beatNumber.textContent = '07'; beatName.textContent = 'RESOLVED POSTER'; beatTime.textContent = '7.45s semantic frame'; progress.style.width = '62.1%'; }
    else play(true);
  });
  document.addEventListener('keydown', function (event) { if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); playing ? pause() : play(false); } });
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { reduced = true; state('poster'); document.querySelector('[data-action="reduced"]').setAttribute('aria-pressed', 'true'); beatNumber.textContent = '07'; beatName.textContent = 'RESOLVED POSTER'; beatTime.textContent = '7.45s semantic frame'; progress.style.width = '62.1%'; }
  else play(true);
}());