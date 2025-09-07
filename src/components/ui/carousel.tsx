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
    className={`flex-shrink-0 w-full snap-center ${props.className || ""}`}
  >
    {props.children}
  </div>
));
CarouselItem.displayName = "CarouselItem";

export const CarouselNext = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => (
  <button ref={ref} {...props}>{props.children}</button>
));
CarouselNext.displayName = "CarouselNext";

export const CarouselPrevious = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => (
  <button ref={ref} {...props}>{props.children}</button>
));
CarouselPrevious.displayName = "CarouselPrevious";

export const CarouselContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <div ref={ref} {...props}>{props.children}</div>
));
CarouselContent.displayName = "CarouselContent";