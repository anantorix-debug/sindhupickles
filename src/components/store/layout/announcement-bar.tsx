import { Truck } from "lucide-react";

export function AnnouncementBar() {
  return (
    <div className="bg-banner text-[13px] text-white">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-2 sm:px-8 lg:px-20">
        <p className="truncate font-medium">Traditional Homemade Indian Non-Veg Pickles — No Artificial Preservatives!</p>
        <p className="hidden shrink-0 items-center gap-2 font-semibold md:flex">
          <Truck className="size-3.5" aria-hidden /> Express Delivery Across India!
        </p>
      </div>
    </div>
  );
}
