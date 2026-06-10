import React from "react";

/** 动态组件注册表 —— 内置组件 + LLM 生成的自定义组件都注册到这里 */
const registry = new Map<string, React.FC<Record<string, unknown>>>();

export function registerComponent(
  name: string,
  component: React.FC<Record<string, unknown>>
): void {
  registry.set(name, component);
}

export function getComponent(
  name: string
): React.FC<Record<string, unknown>> | undefined {
  return registry.get(name);
}

export function hasComponent(name: string): boolean {
  return registry.has(name);
}

export function listComponents(): string[] {
  return Array.from(registry.keys());
}
