import { ErrorModal, useErrorModal, hideErrorModal } from "./error-modal";

export function ErrorModalProvider() {
  const { isOpen, title, message } = useErrorModal();

  return (
    <ErrorModal
      isOpen={isOpen}
      onClose={hideErrorModal}
      title={title}
      message={message}
    />
  );
}
