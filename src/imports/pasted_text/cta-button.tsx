<Button
        width="md"
        className={styles.cta}
        onClick={() => setIsRequestOpen(true)}
      >
        Оставить заявку
      </Button>

      <ResponsiveModal
        isOpen={isRequestOpen}
        onClose={() => setIsRequestOpen(false)}
        ariaLabel="Заявка на путешествие"
      >
        <CorporateRequestForm subheading="Поможем подобрать подходящий тур." />
      </ResponsiveModal>
    </section>
  );
};
@reference "../../../app/globals.css";

.section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.head {
  max-width: 45rem;
  margin: 0 auto;
  text-align: center;
  color: var(--color-text-headings-2);
}

.grid {
  @apply lg:mt-15 lg:mb-11 mt-10 mb-10;
  display: grid;
  gap: 1.5rem;
}

.cta {
  align-self: center;
}

@media (min-width: 64rem) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

15. Для текста сделай копонент Typography и переиспользуй его в проекте, вот пример: 
"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

const typographyVariants = cva("", {
  variants: {
    type: {
      h1: "text-[1.5rem] sm:text-[2.25rem] md:text-[3rem] 2xl:text-[4rem] font-normal leading-[106%] text-text-headings-2",
      h2: "text-[1.5rem] md:text-[2.25rem] 2xl:text-[2.25rem] font-normal leading-1.1 text-text-headings-2",
      h3: "text-[1.25rem] md:text-[1.25rem] 2xl:text-[1.25rem] leading-1.2 text-text-headings-2",
      h4: "text-[1.25rem] md:text-[1.5rem] 2xl:text-[1.5rem] leading-1.2 text-text-headings-2",
      h5: "text-[1.5rem] md:text-[1.5rem] 2xl:text-[1.5rem] leading-1.2 text-text-headings-2",

      p1: "text-[0.875rem] md:text-[1rem] 2xl:text-[1rem] font-normal leading-1.2",
      p2: "text-[1rem] md:text-[1.25rem] 2xl:text-[1.25rem] font-normal leading-1.2",
      p3: "text-[1.25rem] md:text-[1.5rem] 2xl:text-[1.5rem] font-normal leading-1.2",
      p4: "text-[0.875rem] md:text-[0.875rem] 2xl:text-[0.875rem] font-normal leading-1.2",
      p5: "text-[1rem] md:text-[1rem] 2xl:text-[1rem] font-normal leading-1.2",
      p6: "text-[0.75rem] md:text-[0.75rem] 2xl:text-[0.75rem] font-normal leading-1.2",
    },
  },
  defaultVariants: {
    type: "p1",
  },
});

type Props = ComponentProps<"p"> &
  VariantProps<typeof typographyVariants> & { asChild?: boolean };

const tagByType = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  p1: "p",
  p2: "p",
  p3: "p",
  p4: "p",
  p5: "p",
  p6: "p",
};

export function Typography({
  className,
  type,
  asChild = false,
  ...props
}: Props) {
  const defaultTag = (type && tagByType[type]) || "p";
  const Comp = asChild ? Slot : defaultTag;

  return (
    <Comp className={cn(typographyVariants({ type, className }))} {...props} />
  );
}

16. Старайся создавать компоненты для переиспользования в проекте, например: 
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center py-3 px-3 uppercase cursor-pointer font-medium justify-center gap-2 whitespace-nowrap rounded-(--radius-3) text-base max-sm:text-sm transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        primary: "bg-primary text-text-body hover:bg-primary-hovered",
      },
      width: {
        sm: "w-full max-w-[10.875rem]",
        md: "w-full max-w-[21.5rem]",
        full: "w-full min-w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      width: "full",
    },
  },
);