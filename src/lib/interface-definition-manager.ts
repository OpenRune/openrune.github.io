import {
  type ComponentType,
  type ComponentTypeJson,
  type InterfaceType,
  type InterfaceTypeJson,
  ensureComponentId,
  interfaceIdFromPacked,
  normalizeInterfaceType,
} from "@/lib/types/interface-component-type";

const DEFERRED_CLICK_PARENT = -1412584499;

type DrawInterfaceCall = {
  parentId: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  x: number;
  y: number;
  rootIndex: number;
  components: Record<number, ComponentType>;
};

export type DrawWidgetsResult = {
  loaded: boolean;
  calls: DrawInterfaceCall[];
  validRootWidgets: boolean[];
};

export class InterfaceDefinitionManager {
  private interfaces = new Map<number, InterfaceType>();

  private field1453: Record<number, ComponentType> | null = null;

  private field2040 = 0;

  private field1167 = 0;

  public readonly validRootWidgets = Array.from({ length: 100 }, () => false);

  registerInterface(interfaceId: number, interfaceType: InterfaceTypeJson): void {
    const normalized = normalizeInterfaceType(interfaceType);
    this.interfaces.set(interfaceId, {
      ...normalized,
      internalId: normalized.internalId ?? interfaceId,
    });
  }

  registerInterfaceFromJson(interfaceId: number, json: string): void {
    const parsed = JSON.parse(json) as InterfaceTypeJson;
    this.registerInterface(interfaceId, parsed);
  }

  registerPackedComponents(components: ComponentTypeJson[]): void {
    const grouped = new Map<number, Record<string, ComponentTypeJson>>();
    for (const component of components) {
      const packed =
        typeof component.packedId === "number"
          ? component.packedId
          : typeof component.internalId === "number"
            ? component.internalId
            : null;
      if (packed == null) continue;
      const interfaceId = interfaceIdFromPacked(packed);
      const componentId = ensureComponentId(component);
      const bucket = grouped.get(interfaceId) ?? {};
      bucket[String(componentId)] = component;
      grouped.set(interfaceId, bucket);
    }

    for (const [interfaceId, group] of grouped) {
      this.registerInterface(interfaceId, {
        components: group,
        internalId: interfaceId,
      });
    }
  }

  registerPackedComponentsFromJson(json: string): void {
    const parsed = JSON.parse(json) as ComponentTypeJson[];
    this.registerPackedComponents(parsed);
  }

  loadInterface(interfaceId: number): boolean {
    return this.interfaces.has(interfaceId);
  }

  getInterface(interfaceId: number): InterfaceType | null {
    return this.interfaces.get(interfaceId) ?? null;
  }

  drawWidgets(
    var0: number,
    var1: number,
    var2: number,
    var3: number,
    var4: number,
    var5: number,
    var6: number,
    var7: number,
  ): DrawWidgetsResult {
    const loaded = this.loadInterface(var0);
    const calls: DrawInterfaceCall[] = [];

    if (loaded) {
      this.field1453 = null;
      const root = this.getInterface(var0)?.components ?? {};
      calls.push(this.drawInterface(root, -1, var1, var2, var3, var4, var5, var6, var7));
      if (this.field1453) {
        calls.push(
          this.drawInterface(
            this.field1453,
            DEFERRED_CLICK_PARENT,
            var1,
            var2,
            var3,
            var4,
            this.field2040,
            this.field1167,
            var7,
          ),
        );
        this.field1453 = null;
      }
    } else if (var7 !== -1 && var7 < this.validRootWidgets.length) {
      this.validRootWidgets[var7] = true;
    } else {
      this.validRootWidgets.fill(true);
    }

    return {
      loaded,
      calls,
      validRootWidgets: [...this.validRootWidgets],
    };
  }

  private drawInterface(
    components: Record<number, ComponentType>,
    parentId: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    x: number,
    y: number,
    rootIndex: number,
  ): DrawInterfaceCall {
    return {
      parentId,
      minX,
      minY,
      maxX,
      maxY,
      x,
      y,
      rootIndex,
      components,
    };
  }
}
