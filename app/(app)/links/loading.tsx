import { Bone, ListSkeleton, UsageMeterSkeleton } from "@/components/links/skeletons";

/** Mirrors the real page: title row, usage meter, toolbar, list. */
export default function LinksLoading() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Bone className="h-[38px] w-28 md:h-[46px]" />
        <Bone className="h-11 w-36" />
      </div>
      <div className="mt-5"><UsageMeterSkeleton /></div>
      <div className="mt-5 grid gap-3">
        <div className="flex gap-2">
          <Bone className="h-12 min-w-0 flex-1" />
          <Bone className="hidden h-12 w-44 md:block lg:hidden" />
          <Bone className="hidden h-12 w-48 md:block" />
          <Bone className="h-12 w-[88px] md:hidden" />
        </div>
        <div className="hidden gap-2 lg:flex">
          {Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-11 w-24" />)}
        </div>
      </div>
      <div className="mt-4"><ListSkeleton /></div>
    </>
  );
}
