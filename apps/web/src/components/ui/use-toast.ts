import { toast } from 'react-hot-toast';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}

export function useToast() {
  const showToast = (options: ToastOptions) => {
    const message = options.title 
      ? `${options.title}${options.description ? '\n' + options.description : ''}`
      : options.description || '';

    switch (options.variant) {
      case 'destructive':
        toast.error(message, { duration: options.duration });
        break;
      case 'success':
        toast.success(message, { duration: options.duration });
        break;
      default:
        toast(message, { duration: options.duration });
    }
  };

  return {
    toast: showToast,
  };
}