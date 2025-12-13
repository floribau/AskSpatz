import { toast as sonnerToast } from "sonner"

export function useToast() {
  return {
    toast: (props: {
      title?: string
      description?: string
      variant?: "default" | "destructive" | "success"
    }) => {
      if (props.variant === "destructive") {
        sonnerToast.error(props.title, {
          description: props.description,
        })
      } else if (props.variant === "success") {
        sonnerToast.success(props.title, {
          description: props.description,
        })
      } else {
        sonnerToast(props.title, {
          description: props.description,
        })
      }
    },
  }
}

export { sonnerToast as toast }
