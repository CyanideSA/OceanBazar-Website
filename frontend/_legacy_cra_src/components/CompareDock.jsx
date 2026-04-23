import React, { useState } from "react";
import { GitCompare } from "lucide-react";
import { useComparison } from "../context/ComparisonContext";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import ComparisonPanel from "./ComparisonPanel";

/**
 * Floating compare entry point + modal table (works on mobile and dark theme).
 */
export default function CompareDock() {
  const { comparisonList, removeFromComparison, clearComparison, comparisonCount } = useComparison();
  const [open, setOpen] = useState(false);

  if (comparisonCount <= 0) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4 pointer-events-none">
        <div className="max-w-screen-2xl mx-auto flex justify-end pointer-events-auto">
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-2xl shadow-lg bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-11 sm:h-12 px-4 sm:px-5 gap-2 text-sm font-semibold"
          >
            <GitCompare className="w-4 h-4 sm:w-5 sm:h-5" />
            Compare
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{comparisonCount}</span>
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-[95vw] w-full max-h-[min(90vh,900px)] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 p-4 sm:p-6">
          <DialogHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <DialogTitle className="text-left text-gray-900 dark:text-gray-100">Product comparison</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
              onClick={() => {
                clearComparison();
                setOpen(false);
              }}
            >
              Clear all
            </Button>
          </DialogHeader>
          <ComparisonPanel
            comparisonList={comparisonList}
            removeFromComparison={removeFromComparison}
            clearComparison={() => {
              clearComparison();
              setOpen(false);
            }}
            showHeaderActions={false}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
