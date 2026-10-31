'use strict';
document.querySelector('#run').onclick = async () => {
  const button = document.querySelector('#run'); button.disabled = true;
  try {
    // Load the actual game document, not a copied fixture or a cross-window DOM proxy.
    const response = await fetch('index.html');
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const html = await response.text();
    document.open();
    document.write(html.replace('</body>', '<script src="audio-ui-tests.js"></script><script src="ui-test-runner.js"></script></body>'));
    document.close();
  } catch (error) {
    document.querySelector('#summary').textContent = `Ошибка запуска: ${error.message}`;
    button.disabled = false;
  }
};
