/* The library must load first. Scripts are after the markup, so the DOM is ready. */
const { createTracker, createCallbackReceiver } = TrackEvents;
const tracker = createTracker({
  root: document.querySelector('#shop'),
  schema: { price: 'number' },
  receivers: [createCallbackReceiver({
    name: 'example',
    send(event) { document.querySelector('#events').textContent += JSON.stringify(event) + '\n'; },
  })],
});
tracker.start();
document.querySelector('#add').addEventListener('click', () => {
  const button = document.createElement('button');
  button.setAttribute('data-track-event', 'dynamic_requested');
  button.textContent = 'Динамическое действие';
  document.querySelector('#dynamic').append(button);
});
document.querySelector('#stop').addEventListener('click', () => tracker.destroy());
document.querySelector('#start').addEventListener('click', () => tracker.start());
