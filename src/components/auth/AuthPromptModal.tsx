import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, Briefcase } from 'lucide-react';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function AuthPromptModal({ 
  isOpen, 
  onClose, 
  title,
  description 
}: AuthPromptModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const handleLogin = () => {
    onClose();
    navigate('/login', { state: { from: location } });
  };

  const handleSignup = () => {
    onClose();
    navigate('/signup', { state: { from: location } });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">
            {title || t('jobDetail.loginRequired')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {description || t('jobDetail.loginToApply')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-6">
          <Button 
            onClick={handleLogin} 
            className="w-full h-12 text-base"
            size="lg"
          >
            <LogIn className="mr-2 h-5 w-5" />
            {t('nav.login')}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('auth.orContinueWith')}
              </span>
            </div>
          </div>

          <Button 
            onClick={handleSignup} 
            variant="outline" 
            className="w-full h-12 text-base"
            size="lg"
          >
            <UserPlus className="mr-2 h-5 w-5" />
            {t('nav.signup')}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('auth.createAccountBenefits')}
        </p>
      </DialogContent>
    </Dialog>
  );
}
