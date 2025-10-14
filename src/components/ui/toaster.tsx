"use client"

import { useToast } from "../../hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast"
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  const getToastIcon = (variant?: string | null) => {
    switch (variant) {
      case "destructive":
        return <XCircle className="h-5 w-5 text-white" />
      case "success":
        return <CheckCircle className="h-5 w-5 text-white" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-white" />
      case "info":
        return <Info className="h-5 w-5 text-white" />
      default:
        return <CheckCircle className="h-5 w-5 text-white" />
    }
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3 w-full">
              <div className="flex-shrink-0 mt-0.5">
                {getToastIcon(variant)}
              </div>
              <div className="grid gap-1 flex-1 min-w-0">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action && (
                <div className="flex-shrink-0">
                  {action}
                </div>
              )}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
