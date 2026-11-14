import * as React from 'react';

export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonVariantsProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
  outline: 'border border-border bg-background text-foreground hover:bg-muted',
  secondary: 'bg-accent text-accent-foreground hover:opacity-90',
  ghost: 'text-foreground hover:bg-muted',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizeStyles: Record<ButtonSize, string> = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 rounded-sm px-3 text-xs',
  lg: 'h-10 rounded-md px-8 text-base',
  icon: 'h-9 w-9 text-sm',
};

export function buttonVariants({
  variant = 'default',
  size = 'default',
  className = '',
}: ButtonVariantsProps = {}): string {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors motion-safe:transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50';

  return [base, variantStyles[variant], sizeStyles[size], className]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'default',
      size = 'default',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonVariants({ variant, size, className })}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
