export const showToast = (message: string) => {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: message }));
};
