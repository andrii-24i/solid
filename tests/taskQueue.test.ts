import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Config } from '../src/core/config.js';
import {
  clearTasks,
  scheduleTask,
  setTasksEnabled,
} from '../src/renderCore.js';

const delay = Config.taskDelay;
beforeEach(() => {
  vi.useFakeTimers();
  clearTasks();
  setTasksEnabled(false);
  Config.taskDelay = 10;
});
afterEach(() => {
  clearTasks();
  setTasksEnabled(false);
  Config.taskDelay = delay;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('background task queue', () => {
  it('keeps one timer while enqueues and callbacks add work', () => {
    const calls: number[] = [];
    setTasksEnabled(true);
    scheduleTask(() => {
      calls.push(1);
      scheduleTask(() => calls.push(3));
    });
    scheduleTask(() => calls.push(2));
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(10);
    expect(calls).toEqual([1]);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(20);
    expect(calls).toEqual([1, 2, 3]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does no disabled work and resumes in priority order', () => {
    const calls: string[] = [];
    setTasksEnabled(true);
    scheduleTask(() => calls.push('low'));
    setTasksEnabled(false);
    scheduleTask(() => calls.push('high'), 'high');
    vi.advanceTimersByTime(100);
    expect(calls).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    setTasksEnabled(true);
    vi.advanceTimersByTime(10);
    expect(calls).toEqual(['high']);
    vi.advanceTimersByTime(10);
    expect(calls).toEqual(['high', 'low']);
  });

  it('clears pending work and cannot run it after a new batch starts', () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    setTasksEnabled(true);
    scheduleTask(stale);
    clearTasks();
    expect(vi.getTimerCount()).toBe(0);
    scheduleTask(fresh);
    vi.advanceTimersByTime(10);
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('continues the queue after a task throws', () => {
    const next = vi.fn();
    setTasksEnabled(true);
    scheduleTask(() => {
      throw new Error('task failed');
    });
    scheduleTask(next);
    expect(() => vi.advanceTimersByTime(10)).toThrow('task failed');
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(10);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
