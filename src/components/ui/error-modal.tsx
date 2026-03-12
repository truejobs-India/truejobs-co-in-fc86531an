import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export function ErrorModal({ 
  isOpen, 
  onClose, 
  title = "Something went wrong",
  message 
}: ErrorModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-0 shadow-primary-lg">
        <div className="absolute inset-0 bg-gradient-card rounded-lg -z-10" />
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center shadow-primary">
            <AlertCircle className="h-8 w-8 text-primary-foreground" />
          </div>
          <DialogTitle className="text-xl text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center mt-6">
          <Button 
            onClick={onClose} 
            className="bg-gradient-primary hover:opacity-90 text-primary-foreground px-8"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Global state for error modal
type ErrorModalState = {
  isOpen: boolean;
  title: string;
  message: string;
};

const listeners: Array<(state: ErrorModalState) => void> = [];
let memoryState: ErrorModalState = { isOpen: false, title: "", message: "" };

function dispatch(state: ErrorModalState) {
  memoryState = state;
  listeners.forEach((listener) => listener(memoryState));
}

export function showErrorModal(message: string, title?: string) {
  dispatch({
    isOpen: true,
    title: title || "Something went wrong",
    message,
  });
}

export function hideErrorModal() {
  dispatch({ ...memoryState, isOpen: false });
}

export function useErrorModal() {
  const [state, setState] = React.useState<ErrorModalState>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    showError: showErrorModal,
    hideError: hideErrorModal,
  };
}
