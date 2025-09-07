"use client";
import * as React from "react";
import { forwardRef } from "react";

export const Carousel = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <div
    ref={ref}
    {...props}
    className={`overflow-x-auto flex snap-x snap-mandatory scrollbar-none ${props.className || ""}`}
  >
    {props.children}
  </div>
));
Carousel.displayName = "Carousel";

export const CarouselItem = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <div
    ref={ref}
    {...props}
    className={`flex-shrink-0 w-80 snap-center p-2 ${props.className || ""}`}
  >
    {props.children}
  </div>
));
CarouselItem.displayName = "CarouselItem";