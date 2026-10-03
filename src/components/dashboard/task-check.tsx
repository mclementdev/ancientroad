"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleTaskDoneAction } from "@/server/actions/tasks";

export function TaskCheck({ taskId, done, label }: { taskId: string; done: boolean; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Checkbox
      aria-label={label}
      checked={done}
      disabled={pending}
      onCheckedChange={(v) =>
        start(async () => {
          const res = await toggleTaskDoneAction(taskId, v === true);
          if (!res?.ok) toast.error(res?.message);
        })
      }
    />
  );
}
