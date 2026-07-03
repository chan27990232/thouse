"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider@1.2.3";

import { cn } from "./utils";

const NAVY = "#1a365d";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  variant = "default",
  rangeClassName,
  thumbClassName,
  trackClassName,
  rangeStyle,
  thumbStyle,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  variant?: "default" | "navy";
  rangeClassName?: string;
  thumbClassName?: string;
  trackClassName?: string;
  rangeStyle?: React.CSSProperties;
  thumbStyle?: React.CSSProperties;
}) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  const isNavy = variant === "navy";

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        isNavy && "py-1",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
          isNavy
            ? "bg-gray-200 data-[orientation=horizontal]:h-1.5"
            : "bg-muted data-[orientation=horizontal]:h-4",
          trackClassName,
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
            isNavy ? "bg-[#1a365d]" : "bg-primary",
            rangeClassName,
          )}
          style={isNavy ? undefined : rangeStyle}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "block shrink-0 rounded-full transition-[box-shadow,transform] disabled:pointer-events-none disabled:opacity-50",
            isNavy
              ? "size-[18px] border-2 border-[#1a365d] bg-white shadow-[0_1px_4px_rgba(26,54,93,0.25)] hover:shadow-[0_2px_8px_rgba(26,54,93,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a365d]/25 active:scale-110"
              : "border-primary bg-background ring-ring/50 size-4 border shadow-sm hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden",
            thumbClassName,
          )}
          style={isNavy ? undefined : thumbStyle}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider, NAVY as SLIDER_NAVY };
