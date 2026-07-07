// Cache.ts
import { sys } from 'cc'; // 导入 Cocos 内置的 sys 模块

export default class Cache {
    private static instance: Cache | null = null;
    private prefix: string = '';

    /**
     * 获取单例实例
     * @param prefix 缓存前缀（默认 NEOPRO），仅第一次调用时有效
     */
    static getInstance(prefix: string = 'NEOPRO'): Cache {
        if (Cache.instance === null) {
            Cache.instance = new Cache(prefix);
        }
        return Cache.instance;
    }

    /**
     * 私有构造函数（确保只能通过 getInstance 创建）
     * @param prefix 缓存前缀（默认 NEOPRO）
     */
    private constructor(prefix: string = 'NEOPRO') {
        this.prefix = prefix || this.prefix;
        this.prefix = `${this.prefix}_`;
    }

    /**
     * 设置缓存（add/set 均指向 put 方法，保持原有调用习惯）
     * @param key 缓存标识
     * @param value 缓存值（支持任意可序列化类型）
     * @param expire 有效期（秒），0 表示永久有效
     */
    public add(key: string, value: any = '', expire: number = 0): void {
        this.put(key, value, expire);
    }

    public set(key: string, value: any = '', expire: number = 0): void {
        this.put(key, value, expire);
    }

    /**
     * 核心存储方法
     * @param key 缓存标识
     * @param value 缓存值
     * @param expire 有效期（秒）
     */
    public put(key: string, value: any = '', expire: number = 0): void {
        if (typeof key === 'undefined' || key === '') return;

        try {
            const now = Math.ceil(new Date().getTime() / 1000);
            const cacheData = {
                item: value,
                expire: expire === 0 ? 0 : now + expire,
            };

            sys.localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(cacheData));
        } catch (error) {
        }
    }

    /**
     * 获取缓存
     * @param key 缓存标识
     * @returns 缓存值（过期/不存在返回 null）
     */
    public get(key: string): any {
        if (typeof key === 'undefined' || key === '') return null;

        const cacheKey = `${this.prefix}${key}`;
        const result = sys.localStorage.getItem(cacheKey);

        if (!result) return null;

        try {
            const $r = JSON.parse(result);
            if (!$r || typeof $r !== 'object' || (!Object.prototype.hasOwnProperty.call($r, 'item') && !Object.prototype.hasOwnProperty.call($r, 'expire'))) {
                return $r;
            }

            if ($r.expire === 0) return $r.item;

            const now = Math.ceil(new Date().getTime() / 1000);
            if ($r.expire < now) {
                this.remove(key);
                return null;
            } else {
                return $r.item;
            }
        } catch (error) {
            this.remove(key);
            return null;
        }
    }

    /**
     * 获取缓存剩余有效期
     * @param key 缓存键
     * @returns -1=永久有效，0=不存在/已过期，其他=剩余秒数
     */
    public expire(key: string): number {
        if (typeof key === 'undefined' || key === '') return 0;

        const cacheKey = `${this.prefix}${key}`;
        const data = sys.localStorage.getItem(cacheKey);
        if (!data) return 0;

        try {
            const $r = JSON.parse(data);
            if ($r.expire === 0) return -1;

            const now = Math.ceil(new Date().getTime() / 1000);
            const remain = $r.expire - now;
            return remain > 0 ? remain : 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 删除缓存（rm/del/delete 均指向 remove 方法）
     * @param key 缓存标识
     */
    public rm(key: string): void {
        this.remove(key);
    }

    public del(key: string): void {
        this.remove(key);
    }

    public delete(key: string): void {
        this.remove(key);
    }

    public remove(key: string): void {
        if (typeof key === 'undefined' || key === '') return;

        const cacheKey = `${this.prefix}${key}`;
        sys.localStorage.removeItem(cacheKey);
    }

    /**
     * 清空所有缓存
     */
    public clear(): void {
        sys.localStorage.clear();
    }

    /**
     * 销毁单例（可选）
     */
    static destroy(): void {
        Cache.instance = null;
    }

    /**
     * 获取当前缓存前缀
     */
    public getPrefix(): string {
        return this.prefix;
    }

    /**
     * 获取所有缓存键（返回当前前缀的所有键）
     */
    public getAllKeys(): string[] {
        const keys: string[] = [];
        const length = sys.localStorage.length;

        for (let i = 0; i < length; i++) {
            const key = sys.localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keys.push(key.substring(this.prefix.length));
            }
        }

        return keys;
    }

    /**
     * 获取所有缓存信息
     */
    public getAllCacheInfo(): Array<{ key: string; value: any; expire: number }> {
        const keys = this.getAllKeys();
        const cacheInfo: Array<{ key: string; value: any; expire: number }> = [];

        keys.forEach((key) => {
            const value = this.get(key);
            if (value !== null) {
                const expireTime = this.expire(key);
                cacheInfo.push({
                    key,
                    value,
                    expire: expireTime,
                });
            }
        });

        return cacheInfo;
    }

    /**
     * 获取缓存统计信息
     */
    public getStatistics(): { total: number; expired: number; active: number } {
        const keys = this.getAllKeys();
        let expired = 0;
        let active = 0;

        keys.forEach((key) => {
            const expireTime = this.expire(key);
            if (expireTime === 0) {
                expired++;
            } else {
                active++;
            }
        });

        return {
            total: keys.length,
            expired,
            active,
        };
    }
}
