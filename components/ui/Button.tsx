type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "ghost" | "danger";
};

const variants = {
  primary: "bg-emerald-500 text-neutral-950 hover:bg-emerald-400",
  ghost: "text-neutral-300 hover:bg-white/10",
  danger: "bg-red-500 text-white hover:bg-red-400",
};

export default function Button({
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
