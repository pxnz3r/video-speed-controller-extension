const ids = ['quality', 'perf'];

chrome.storage.local.get({ quality: false, perf: false }, (s) => {
  for (const id of ids) {
    const box = document.getElementById(id);
    box.checked = s[id];
    box.addEventListener('change', () => chrome.storage.local.set({ [id]: box.checked }));
  }
});
