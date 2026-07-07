import { Node, EventTarget, Input, EventTouch, Vec2, director } from 'cc';
import { WoodenFish } from '../constants/Game';
import { USE_SOUND_MODE } from '../constants/Home';

// 定义事件回调类型
type EventCallback = (...args: any[]) => any;

// 定义存储事件信息的接口
interface EventListenerInfo {
    target: Node | EventTarget; // 保存原始类型
    callback: EventCallback;
    originalEventName: string;
    originalCallback: EventCallback;
    owner?: any;
    methodName?: string;
}

/**
 * Cocos Creator 事件管理器
 * 单例模式，统一管理事件的绑定和释放
 * 支持自动在 Node 销毁时清理其所有监听的事件
 */
export default class EventManager {
    private static instance: EventManager | null = null;
    private static readonly CLICK_SOUND_PATH = 'common/sound/click';

    // Map<eventName, Set<EventListenerInfo>>
    private bindEvents: Map<string, Set<EventListenerInfo>> = new Map();

    // Map<Node, Set<string>>
    // 仅用于追踪 Node 类型绑定过的真实事件名
    private nodeEventsMap: Map<Node, Set<string>> = new Map();

    public static getInstance(): EventManager {
        if (!EventManager.instance) {
            EventManager.instance = new EventManager();
        }
        return EventManager.instance;
    }

    private toucePos: Vec2 | null = null
    private isMoved: boolean = false
    private moveThreshold: number = 10

    private loadingCount: number = 0

    private get isLoading(): boolean {
        return this.loadingCount > 0
    }

    private isPromiseLike(value: any): value is PromiseLike<any> {
        return !!value && typeof value.then === 'function'
    }

    private handleCallbackError(context: string, error: any) {
        console.warn(`[EventManager] ${context} failed`, error)
    }

    private callEventCallback(callback: EventCallback | undefined, owner: any, args: any[], context: string) {
        if (typeof callback !== 'function') {
            return
        }

        try {
            const result = callback.apply(owner, args)
            if (this.isPromiseLike(result)) {
                Promise.resolve(result).catch((error) => this.handleCallbackError(context, error))
            }
        } catch (error) {
            this.handleCallbackError(context, error)
        }
    }

    private wrapCallback(callback: EventCallback, context: string): EventCallback {
        const manager = this
        return function (this: any, ...args: any[]) {
            manager.callEventCallback(callback, this, args, context)
        }
    }

    // 私有构造函数确保单例
    private constructor() {
        director.on(WoodenFish.BLOCKING_LOADING, () => {
            this.loadingCount++
            console.log('[EventLoadingTrace] ++', JSON.stringify({
                loadingCount: this.loadingCount,
            }))
        }, this)

        director.on(WoodenFish.BLOCKING_LOADED, () => {
            this.loadingCount = Math.max(0, this.loadingCount - 1)
            console.log('[EventLoadingTrace] --', JSON.stringify({
                loadingCount: this.loadingCount,
            }))
        }, this)
    }

    public on(target: Node | EventTarget | null | undefined,
        eventName: string,
        callback: EventCallback,
        obj?: any,
        _methodName?: string) {
        if (!target) {
            return;
        }

        switch (eventName) {
            case WoodenFish.CLICK:
                this._on(target, Input.EventType.TOUCH_START, (e: EventTouch) => {
                    this._TouchStart(e)
                }, obj, WoodenFish.CLICK, callback)

                this._on(target, Input.EventType.TOUCH_MOVE, (e: EventTouch) => {
                    this._TouchMove(e)
                }, obj, WoodenFish.CLICK, callback)

                this._on(target, Input.EventType.TOUCH_END, (e: EventTouch) => {
                    this._TouchEnd(e, callback, obj, _methodName === 'silent-click-sound')
                }, obj, WoodenFish.CLICK, callback)
                break
            default:
                this._on(target, eventName, callback, obj)
        }

        // this.on(target, eventName, callback, obj)
    }

    private _TouchEnd(e: EventTouch, cb?: EventCallback, owner?: any, silentClickSound: boolean = false) {
        if (this.isLoading) {
            console.log('[EventLoadingTrace] block TOUCH_END', JSON.stringify({
                loadingCount: this.loadingCount,
            }))
            return
        }
        const wasMoved = this.isMoved
        this.isMoved = false
        if (wasMoved) return

        this.callEventCallback(cb, owner, [e], 'click callback')

        if (silentClickSound) {
            return
        }

        if (!(e as any).__WoodenFishClickSoundScheduled) {
            (e as any).__WoodenFishClickSoundScheduled = true
            Promise.resolve().then(() => {
                // this.$sm.play(USE_SOUND_MODE.APP, EventManager.CLICK_SOUND_PATH)
            })
        }
    }

    private _TouchStart(e: EventTouch) {
        if (this.isLoading) {
            console.log('[EventLoadingTrace] block TOUCH_START', JSON.stringify({
                loadingCount: this.loadingCount,
            }))
            return
        }
        this.toucePos = e.getUILocation()
        this.isMoved = false
    }

    private _TouchMove(e: EventTouch) {
        if (this.isLoading) {
            console.log('[EventLoadingTrace] block TOUCH_MOVE', JSON.stringify({
                loadingCount: this.loadingCount,
            }))
            return
        }
        if (!this.toucePos) return
        const curPos = e.getUILocation()
        const deltaX = curPos.x - this.toucePos.x
        const deltaY = curPos.y - this.toucePos.y
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
        if (distance > this.moveThreshold) {
            this.isMoved = true
        }
    }

    /**
     * 添加事件监听
     * @param target 事件目标 (Node 或其他 EventTarget)
     * @param eventName 事件名称
     * @param callback 回调函数
     * @param obj 指向on的target
     */
    public _on(
        target: Node | EventTarget | null | undefined,
        eventName: string,
        callback: EventCallback,
        obj?: any,
        originalEventName: string = eventName,
        originalCallback: EventCallback = callback,
    ): void {
        if (!target) {
            return;
        }

        let callbacksSet = this.bindEvents.get(eventName);
        if (!callbacksSet) {
            callbacksSet = new Set<EventListenerInfo>();
            this.bindEvents.set(eventName, callbacksSet);
        }

        // 检查是否已存在相同的 target-callback 组合，避免重复绑定
        const isDuplicate = Array.from(callbacksSet).some(
            (item) =>
                item.target === target &&
                item.owner === obj &&
                item.originalEventName === originalEventName &&
                item.originalCallback === originalCallback
        );

        if (!isDuplicate) {
            const safeCallback = this.wrapCallback(callback, originalEventName)
            // 根据 target 类型选择合适的绑定方式
            if (target instanceof Node) {
                // Node 类型：使用 Node 的 on 方法
                target.on(eventName, safeCallback, obj);
            } else {
                // EventTarget 类型：使用 EventTarget 的 on 方法
                (target as EventTarget).on(eventName, safeCallback, obj);
            }

            callbacksSet.add({
                target,
                callback: safeCallback,
                originalEventName,
                originalCallback,
                owner: obj,
            });

            // 如果 target 是 Node，则进行生命周期管理
            if (target instanceof Node) {
                this.addNodeToLifecycleManagement(target, eventName);
            }

            //     `[EventManager] 事件 ${eventName} 绑定成功 (目标: ${this.getTargetName(target)})`
            // );
        } else {
        }
    }

    /**
     * 移除事件监听
     * @param target 事件目标
     * @param eventName 事件名称
     * @param callback 回调函数
     */
    public off(target: Node | EventTarget, eventName: string, callback: EventCallback, owner?: any): void {
        for (const [actualEventName, callbacksSet] of this.bindEvents) {
            const callbacksToRemove: EventListenerInfo[] = [];
            for (const item of callbacksSet) {
                if (
                    item.target === target &&
                    item.originalEventName === eventName &&
                    item.originalCallback === callback &&
                    (typeof owner === 'undefined' || item.owner === owner)
                ) {
                    if (target instanceof Node) {
                        target.off(actualEventName, item.callback, item.owner);
                    } else {
                        (target as EventTarget).off(actualEventName, item.callback, item.owner);
                    }
                    callbacksToRemove.push(item);
                }
            }

            callbacksToRemove.forEach((item) => callbacksSet.delete(item));
            if (callbacksSet.size === 0) {
                this.bindEvents.delete(actualEventName);
            }

            if (callbacksToRemove.length > 0 && target instanceof Node) {
                this.removeNodeFromLifecycleManagement(target, actualEventName);
            }
        }

        // if (removed) {
        //         `[EventManager] 事件 ${eventName} 移除成功 (目标: ${this.getTargetName(target)})`
        //     );
        // } else {
        // }
    }

    /**
     * 移除某个事件名称下所有 target 的所有监听
     * @param eventName 事件名称
     */
    public offByEventName(eventName: string): void {
        let count = 0;
        for (const [actualEventName, callbacksSet] of this.bindEvents) {
            const callbacksToRemove: EventListenerInfo[] = [];
            for (const item of callbacksSet) {
                if (item.originalEventName !== eventName) {
                    continue;
                }

                if (item.target instanceof Node) {
                    item.target.off(actualEventName, item.callback, item.owner);
                } else {
                    (item.target as EventTarget).off(actualEventName, item.callback, item.owner);
                }

                callbacksToRemove.push(item);
                count++;
            }

            callbacksToRemove.forEach((item) => callbacksSet.delete(item));

            if (callbacksSet.size === 0) {
                this.bindEvents.delete(actualEventName);
            }

            callbacksToRemove.forEach((item) => {
                if (item.target instanceof Node) {
                    this.removeNodeFromLifecycleManagement(item.target, actualEventName);
                }
            });
        }

    }

    /**
     * 移除指定 Node 的所有事件监听
     * 这是自动清理的核心方法
     * @param targetNode 目标 Node
     */
    public offAllByNode(targetNode: Node): void {
        const nodeEventNames = this.nodeEventsMap.get(targetNode);
        if (!nodeEventNames) {
            return;
        }

        let count = 0;
        // 遍历该 Node 绑定的所有事件名称
        for (const eventName of nodeEventNames) {
            const callbacksSet = this.bindEvents.get(eventName);
            if (callbacksSet) {
                const callbacksToRemove: EventListenerInfo[] = [];
                // 找到该事件名下，target 是 targetNode 的所有回调
                for (const item of callbacksSet) {
                    if (item.target === targetNode) {
                        targetNode.off(eventName, item.callback, item.owner);
                        callbacksToRemove.push(item);
                        count++;
                    }
                }

                // 从管理器中移除这些回调
                callbacksToRemove.forEach((item) => callbacksSet.delete(item));

                // 如果该事件名称下没有其他回调了，则移除这个事件名称的记录
                if (callbacksSet.size === 0) {
                    this.bindEvents.delete(eventName);
                }
            }
        }

        this.nodeEventsMap.delete(targetNode);

    }

    /**
     * 移除管理器中所有已绑定的事件
     */
    public offall(owner?: any): void {
        if (typeof owner !== 'undefined') {
            this.offAllByOwner(owner);
            return;
        }

        let totalCount = 0;

        this.bindEvents.forEach((callbacksSet, eventName) => {
            for (const item of callbacksSet) {
                // 根据 target 类型选择合适的移除方式
                if (item.target instanceof Node) {
                    item.target.off(eventName, item.callback, item.owner);
                } else {
                    (item.target as EventTarget).off(eventName, item.callback, item.owner);
                }
                totalCount++;
            }
        });

        this.bindEvents.clear();
        this.nodeEventsMap.clear();

    }

    /**
     * 仅移除指定 owner 绑定的全部事件。
     * 用法：组件销毁时请调用 offall(this)，避免误清理其他页面的监听。
     */
    public offAllByOwner(owner: any): void {
        if (!owner) {
            return;
        }

        this.bindEvents.forEach((callbacksSet, eventName) => {
            const callbacksToRemove: EventListenerInfo[] = [];
            for (const item of callbacksSet) {
                if (item.owner !== owner) {
                    continue;
                }

                if (item.target instanceof Node) {
                    item.target.off(eventName, item.callback, item.owner);
                } else {
                    (item.target as EventTarget).off(eventName, item.callback, item.owner);
                }
                callbacksToRemove.push(item);
            }

            callbacksToRemove.forEach((item) => callbacksSet.delete(item));
            if (callbacksSet.size === 0) {
                this.bindEvents.delete(eventName);
            }

            callbacksToRemove.forEach((item) => {
                if (item.target instanceof Node) {
                    this.removeNodeFromLifecycleManagement(item.target, eventName);
                }
            });
        });
    }

    /**
     * 将 Node 添加到生命周期管理中，使其在销毁时自动清理事件
     * @param node 目标 Node
     * @param eventName 绑定的事件名称
     */
    private addNodeToLifecycleManagement(node: Node, eventName: string): void {
        let nodeEventNames = this.nodeEventsMap.get(node);
        if (!nodeEventNames) {
            nodeEventNames = new Set<string>();
            this.nodeEventsMap.set(node, nodeEventNames);

            // 监听 Node 的销毁事件
            const onDestroyCallback = () => {
                this.onNodeDestroyed(node);
            };

            node.once(Node.EventType.NODE_DESTROYED, onDestroyCallback);
        }
        nodeEventNames.add(eventName);
    }

    /**
     * 从 Node 的生命周期管理中移除某个事件名称的追踪
     * @param node 目标 Node
     * @param eventName 移除的事件名称
     */
    private removeNodeFromLifecycleManagement(node: Node, eventName: string): void {
        const nodeEventNames = this.nodeEventsMap.get(node);
        if (nodeEventNames) {
            const callbacksSet = this.bindEvents.get(eventName);
            const hasRemainingListeners = callbacksSet
                ? Array.from(callbacksSet).some((item) => item.target === node)
                : false;

            if (hasRemainingListeners) {
                return;
            }

            nodeEventNames.delete(eventName);
            if (nodeEventNames.size === 0) {
                this.nodeEventsMap.delete(node);
            }
        }
    }

    /**
     * Node 销毁时的回调函数，用于自动清理
     * @param node 销毁的 Node
     */
    private onNodeDestroyed(node: Node): void {
        this.offAllByNode(node);
    }

    /**
     * 获取 target 的名称，用于日志输出
     */
    private getTargetName(target: Node | EventTarget): string {
        if (target instanceof Node) {
            return target.name;
        } else {
            return (target as any).name || target.constructor.name;
        }
    }

    /**
     * 获取事件的监听数量
     * @param eventName 事件名称（可选）
     */
    public getListenerCount(eventName?: string): number {
        if (eventName) {
            let total = 0;
            this.bindEvents.forEach((callbacksSet) => {
                callbacksSet.forEach((item) => {
                    if (item.originalEventName === eventName) {
                        total++;
                    }
                });
            });
            return total;
        }

        let total = 0;
        this.bindEvents.forEach((callbacksSet) => {
            total += callbacksSet.size;
        });
        return total;
    }

    /**
     * 获取所有已绑定的事件名称列表
     */
    public getAllEventNames(): string[] {
        return Array.from(this.bindEvents.keys());
    }

    /**
     * 调试：打印当前所有事件的绑定情况
     */
    public debug(): void {
        if (this.bindEvents.size === 0) {
            return;
        }

        this.bindEvents.forEach((callbacksSet, eventName) => {
            callbacksSet.forEach((item) => {
                const targetName = this.getTargetName(item.target);
                const callbackName = item.methodName || item.callback.name || 'anonymous';
            });
        });

        if (this.nodeEventsMap.size === 0) {
        } else {
            this.nodeEventsMap.forEach((eventNames, node) => {
            });
        }
    }
}
