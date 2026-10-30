"use client";

import { useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskPriority, TaskStatus } from "../constants";
import { useCreateTask } from "../queries";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./task-options";

export function CreateTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const user = useSession();
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("");
  const [status, setStatus] = useState<TaskStatus>("to_do");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    create.mutate({ userId: user.id, input: { title: title.trim(), description, module: module.trim() || null, status, priority } });
    // Close at once: the task is already in the list and the server call follows.
    setTitle("");
    setDescription("");
    setModule("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>For work that did not come from Slack. Slack tasks arrive through the sync.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-title">Title</Label>
            <Input id="new-title" required value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-description">Description</Label>
            <Textarea id="new-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-module">Module</Label>
              <Input id="new-module" value={module} onChange={(event) => setModule(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-status">Status</Label>
              <OptionSelect id="new-status" value={status} onValueChange={setStatus} options={STATUS_OPTIONS} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-priority">Priority</Label>
              <OptionSelect id="new-priority" value={priority} onValueChange={setPriority} options={PRIORITY_OPTIONS} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
