import type { ComponentType, ComponentScriptArg } from "@/lib/interface-renderer/component-types";

export type { ComponentType, ComponentScriptArg };

export const PARENT_BIT_OFFSET = 16;
export const PARENT_BIT_MASK = 0xffff;
export const CHILD_BIT_OFFSET = 0;
export const CHILD_BIT_MASK = 0xffff;

export type ComponentTypeJson = Partial<ComponentType> & {
  packedId?: number | null;
  /** Legacy JSON — same as {@link ComponentType.packedId}. */
  internalId?: number | null;
  id?: number;
};

export type InterfaceType = {
  components: Record<number, ComponentType>;
  internalId: number | null;
  internalName: string | null;
};

export type InterfaceTypeJson = {
  components: Record<string, ComponentTypeJson>;
  internalId?: number | null;
  internalName?: string | null;
};

export function interfaceIdFromPacked(packed: number): number {
  return (packed >> PARENT_BIT_OFFSET) & PARENT_BIT_MASK;
}

export function componentIdFromPacked(packed: number): number {
  return (packed >> CHILD_BIT_OFFSET) & CHILD_BIT_MASK;
}

export function ensureComponentId(raw: ComponentTypeJson): number {
  if (typeof raw.id === "number") {
    return raw.id;
  }
  if (typeof raw.packedId === "number") {
    return componentIdFromPacked(raw.packedId);
  }
  if (typeof raw.internalId === "number") {
    return componentIdFromPacked(raw.internalId);
  }
  return 0;
}

export function normalizeComponentType(raw: ComponentTypeJson): ComponentType {
  return {
    v3: raw.v3 ?? false,
    type: raw.type ?? 0,
    buttonType: raw.buttonType ?? 0,
    clientCode: raw.clientCode ?? 0,
    x: raw.x ?? 0,
    y: raw.y ?? 0,
    width: raw.width ?? 0,
    height: raw.height ?? 0,
    tempWidth: raw.tempWidth ?? raw.width ?? 0,
    tempHeight: raw.tempHeight ?? raw.height ?? 0,
    x1: raw.x1,
    y1: raw.y1,
    field3770: raw.field3770,
    field3677: raw.field3677,
    trans1: raw.trans1 ?? 0,
    layer: raw.layer ?? -1,
    mouseOverRedirect: raw.mouseOverRedirect ?? -1,
    cs1Comparisons: raw.cs1Comparisons ?? null,
    cs1ComparisonValues: raw.cs1ComparisonValues ?? null,
    cs1Instructions: raw.cs1Instructions ?? null,
    scrollHeight: raw.scrollHeight ?? 0,
    hide: raw.hide ?? false,
    fill: raw.fill ?? false,
    textAlignH: raw.textAlignH ?? 0,
    textAlignV: raw.textAlignV ?? 0,
    textLineHeight: raw.textLineHeight ?? 0,
    textFont: raw.textFont ?? -1,
    textShadow: raw.textShadow ?? false,
    secondaryText: raw.secondaryText ?? "",
    colour1: raw.colour1 ?? 0,
    colour2: raw.colour2 ?? 0,
    mouseOverColour1: raw.mouseOverColour1 ?? 0,
    mouseOverColour2: raw.mouseOverColour2 ?? 0,
    graphic: raw.graphic ?? -1,
    secondaryGraphic: raw.secondaryGraphic ?? -1,
    modelKind: raw.modelKind ?? 0,
    model: raw.model ?? -1,
    secondaryModelKind: raw.secondaryModelKind ?? 0,
    secondaryModel: raw.secondaryModel ?? -1,
    modelAnim: raw.modelAnim ?? -1,
    secondaryModelAnim: raw.secondaryModelAnim ?? -1,
    modelZoom: raw.modelZoom ?? 0,
    modelAngleX: raw.modelAngleX ?? 0,
    modelAngleY: raw.modelAngleY ?? 0,
    text: raw.text ?? "",
    targetVerb: raw.targetVerb ?? "",
    targetBase: raw.targetBase ?? "",
    events: raw.events ?? 0,
    buttonText: raw.buttonText ?? "",
    widthMode: raw.widthMode ?? 0,
    heightMode: raw.heightMode ?? 0,
    xMode: raw.xMode ?? 0,
    yMode: raw.yMode ?? 0,
    scrollWidth: raw.scrollWidth ?? 0,
    noClickThrough: raw.noClickThrough ?? false,
    angle2d: raw.angle2d ?? 0,
    tiling: raw.tiling ?? false,
    outline: raw.outline ?? 0,
    graphicShadow: raw.graphicShadow ?? 0,
    vFlip: raw.vFlip ?? false,
    hFlip: raw.hFlip ?? false,
    modelX: raw.modelX ?? 0,
    modelY: raw.modelY ?? 0,
    modelAngleZ: raw.modelAngleZ ?? 0,
    modelOrthog: raw.modelOrthog ?? false,
    modelObjWidth: raw.modelObjWidth ?? 0,
    lineWid: raw.lineWid ?? 1,
    lineDirection: raw.lineDirection ?? false,
    opBase: raw.opBase ?? "",
    op: raw.op ?? [],
    dragDeadZone: raw.dragDeadZone ?? 0,
    dragDeadTime: raw.dragDeadTime ?? 0,
    draggableBehavior: raw.draggableBehavior ?? false,
    onLoad: raw.onLoad ?? null,
    onMouseOver: raw.onMouseOver ?? null,
    onMouseLeave: raw.onMouseLeave ?? null,
    onTargetLeave: raw.onTargetLeave ?? null,
    onTargetEnter: raw.onTargetEnter ?? null,
    onVarTransmit: raw.onVarTransmit ?? null,
    onInvTransmit: raw.onInvTransmit ?? null,
    onStatTransmit: raw.onStatTransmit ?? null,
    onTimer: raw.onTimer ?? null,
    onOp: raw.onOp ?? null,
    onMouseRepeat: raw.onMouseRepeat ?? null,
    onClick: raw.onClick ?? null,
    onClickRepeat: raw.onClickRepeat ?? null,
    onRelease: raw.onRelease ?? null,
    onHold: raw.onHold ?? null,
    onDrag: raw.onDrag ?? null,
    onDragComplete: raw.onDragComplete ?? null,
    onScrollWheel: raw.onScrollWheel ?? null,
    onVarTransmitList: raw.onVarTransmitList ?? null,
    onInvTransmitList: raw.onInvTransmitList ?? null,
    onStatTransmitList: raw.onStatTransmitList ?? null,
    packedId: raw.packedId ?? raw.internalId ?? null,
    internalName: raw.internalName ?? null,
    id: ensureComponentId(raw),
    itemIds: raw.itemIds ?? null,
    itemQuantities: raw.itemQuantities ?? null,
  };
}

export function normalizeComponentTypes(raw: ComponentTypeJson[]): ComponentType[] {
  return raw.map(normalizeComponentType);
}

export function normalizeInterfaceType(raw: InterfaceTypeJson): InterfaceType {
  const normalizedComponents: Record<number, ComponentType> = {};

  for (const [rawId, component] of Object.entries(raw.components ?? {})) {
    const normalized = normalizeComponentType({
      ...component,
      id: component.id ?? Number.parseInt(rawId, 10),
    });
    normalizedComponents[normalized.id] = normalized;
  }

  return {
    components: normalizedComponents,
    internalId: raw.internalId ?? null,
    internalName: raw.internalName ?? null,
  };
}
