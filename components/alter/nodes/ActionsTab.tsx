"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconPlus, IconX } from "@tabler/icons-react";
import { GamevalIdSearch } from "@/components/search/GamevalIdSearch";
import { GamevalType } from "@/lib/gamevals/types";
import { DialogueAction, ActionType } from "./types";

interface ActionsTabProps {
  actions: DialogueAction[];
  onChange: (actions: DialogueAction[]) => void;
}

export function ActionsTab({ actions, onChange }: ActionsTabProps) {
  const handleAddAction = useCallback(() => {
    const newAction: DialogueAction = {
      id: `action_${Date.now()}`,
      type: 'remove_item',
      itemName: '',
      amount: 1,
      containerType: 'inventory',
    };
    onChange([...actions, newAction]);
  }, [actions, onChange]);

  const handleRemoveAction = useCallback((actionId: string) => {
    onChange(actions.filter((action) => action.id !== actionId));
  }, [actions, onChange]);

  const handleActionChange = useCallback((actionId: string, key: keyof DialogueAction, value: any) => {
    const updated = actions.map((action) =>
      action.id === actionId ? { ...action, [key]: value } : action
    );
    onChange(updated);
  }, [actions, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase text-muted-foreground">
          Actions
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddAction}
          className="h-7"
        >
          <IconPlus size={14} />
          Add Action
        </Button>
      </div>
      <ScrollArea className="h-64 pr-2 border rounded-lg">
        <div className="space-y-2 py-2">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No actions added
            </p>
          ) : (
            actions.map((action) => (
              <div
                key={action.id}
                className="flex items-start gap-2 p-2 rounded-md bg-muted/30"
              >
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Action Type
                    </label>
                    <Select
                      value={action.type}
                      onValueChange={(value: ActionType) => {
                        const containerType = value.includes('equipment') ? 'equipment' : 'inventory';
                        handleActionChange(action.id, 'type', value);
                        handleActionChange(action.id, 'containerType', containerType);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remove_item">Remove Item (Inventory)</SelectItem>
                        <SelectItem value="add_item">Add Item (Inventory)</SelectItem>
                        <SelectItem value="remove_equipment">Remove Equipment</SelectItem>
                        <SelectItem value="add_equipment">Add Equipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Item Name
                    </label>
                    <GamevalIdSearch
                      mode="gameval"
                      value={action.itemName}
                      onModeChange={() => {}}
                      disabledModes={["id"]}
                      onValueChange={(value) => handleActionChange(action.id, 'itemName', value)}
                      onSuggestionSelect={(suggestion) => {
                        handleActionChange(action.id, 'itemName', suggestion.name);
                        return true;
                      }}
                      gamevalType={GamevalType.ITEMS}
                      className="text-xs"
                      inputClassName="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Amount
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={action.amount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          handleActionChange(action.id, 'amount', val);
                        }
                      }}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 mt-6"
                  onClick={() => handleRemoveAction(action.id)}
                >
                  <IconX size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}


