import { showErrorModal } from "@/components/ui/error-modal";

/**
 * Hook to show themed error modals instead of default toasts
 * Usage: const { showError } = useErrorModal();
 *        showError("Your error message here", "Optional Title");
 */
export function useErrorModal() {
  return {
    showError: (message: string, title?: string) => {
      showErrorModal(message, title);
    },
  };
}

// Direct export for non-hook usage
export { showErrorModal };
