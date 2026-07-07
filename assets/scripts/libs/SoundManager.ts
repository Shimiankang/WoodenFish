import { AudioClip, AudioSource, director, Node, resources } from 'cc';

export default class SoundManager {
    private static instance: SoundManager | null = null;
    private static readonly HIT_SOUND_PATH = 'sound/hit';

    private audioNode: Node | null = null;
    private audioSource: AudioSource | null = null;
    private clips: Map<string, AudioClip> = new Map();

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    private constructor() {}

    public hit(): void {
        this.play(SoundManager.HIT_SOUND_PATH);
    }

    public play(path: string, volume: number = 1): void {
        const cachedClip = this.clips.get(path);
        if (cachedClip) {
            this.playClip(cachedClip, volume);
            return;
        }

        resources.load(path, AudioClip, (error, clip) => {
            if (error || !clip) {
                console.warn(`[SoundManager] load sound failed: ${path}`, error);
                return;
            }

            this.clips.set(path, clip);
            this.playClip(clip, volume);
        });
    }

    private playClip(clip: AudioClip, volume: number): void {
        const audioSource = this.getAudioSource();
        if (!audioSource) {
            return;
        }

        audioSource.playOneShot(clip, volume);
    }

    private getAudioSource(): AudioSource | null {
        if (this.audioSource && this.audioNode && this.audioNode.isValid) {
            return this.audioSource;
        }

        const scene = director.getScene();
        if (!scene) {
            return null;
        }

        this.audioNode = new Node('SoundManager');
        scene.addChild(this.audioNode);
        director.addPersistRootNode(this.audioNode);
        this.audioSource = this.audioNode.addComponent(AudioSource);
        return this.audioSource;
    }
}
