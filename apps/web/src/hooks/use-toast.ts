import { toast } from "sonner"

export interface Toast {
  id: string
  title?: string
  description?: string
  action?: any
  dismiss?: () => void
}

export function useToast() {
  return {
    toast: (props: {
      title?: string
      description?: string
      variant?: "default" | "destructive"
    }) => {
      if (props.variant === "destructive") {
        return toast.error(props.title || props.description)
      }
      return toast.success(props.title || props.description)
    },
    dismiss: toast.dismiss
  }
}