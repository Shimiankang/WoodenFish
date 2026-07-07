import { _decorator, Color, Component, Label, Node, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import EventManager from './libs/EventManager';
import CacheManager from './libs/Cache'
import SoundManager from './libs/SoundManager';
import { WoodenFish } from './constants/Game';
const { ccclass, property } = _decorator;

@ccclass('home')
export class home extends Component {
    private static readonly MERIT_CACHE_KEY = 'MeritCount';
    private static readonly HAMMER_READY_ANGLE = -45;
    private static readonly HAMMER_HIT_ANGLE = 0;
    private static readonly HAMMER_HIT_POSITION_OFFSET = new Vec3(0, -70, 0);

    @property({ tooltip: "功德数", type: Label })
    public Count: Label = null;

    @property({ tooltip: "木鱼", type: Node })
    public WoodenFish: Node = null;

    @property({ tooltip: "木槌", type: Node })
    public WoodenHit: Node = null;

    private hammerStartPosition: Vec3 = new Vec3();
    private hammerStartEuler: Vec3 = new Vec3();
    private hammerStartScale: Vec3 = new Vec3(1, 1, 1);

    private get $event () :EventManager {
        return EventManager.getInstance();
    }

    private get $cache () :CacheManager {
        return CacheManager.getInstance();
    }

    private get $sound () :SoundManager {
        return SoundManager.getInstance();
    }

    onLoad() {
        const MertitLabel = this.Count.getComponent(Label);
        MertitLabel.string = this.$cache.get(home.MERIT_CACHE_KEY) || '0'

        if (this.WoodenHit) {
            this.hammerStartPosition = this.WoodenHit.getPosition().clone();
            this.hammerStartEuler = this.WoodenHit.eulerAngles.clone();
            this.hammerStartScale = this.WoodenHit.getScale().clone();
            this.WoodenHit.active = false;
        }

        this.$event.on(this.WoodenFish, WoodenFish.CLICK, this.hit, this);
    }

    private hit() {
        this.$sound.hit();
        this.playHammerHit();
        this.showMeritBubble();

        const MertitLabel = this.Count.getComponent(Label);
        const currentCount = (Number(MertitLabel.string) || 0) + 1;
        MertitLabel.string = currentCount.toString();
        this.$cache.set(home.MERIT_CACHE_KEY, MertitLabel.string);
    }

    private playHammerHit() {
        if (!this.WoodenHit) {
            return;
        }

        Tween.stopAllByTarget(this.WoodenHit);
        this.WoodenHit.active = true;

        this.WoodenHit.setScale(this.hammerStartScale);
        const hammerHitPosition = this.hammerStartPosition.clone().add(home.HAMMER_HIT_POSITION_OFFSET);
        this.WoodenHit.setPosition(hammerHitPosition);
        this.WoodenHit.setRotationFromEuler(
            this.hammerStartEuler.x,
            this.hammerStartEuler.y,
            this.hammerStartEuler.z + home.HAMMER_READY_ANGLE,
        );

        tween(this.WoodenHit)
            .to(0.08, {
                eulerAngles: new Vec3(
                    this.hammerStartEuler.x,
                    this.hammerStartEuler.y,
                    this.hammerStartEuler.z + home.HAMMER_HIT_ANGLE,
                ),
            }, { easing: 'quadIn' })
            .to(0.12, {
                eulerAngles: new Vec3(
                    this.hammerStartEuler.x,
                    this.hammerStartEuler.y,
                    this.hammerStartEuler.z + home.HAMMER_READY_ANGLE,
                ),
            }, { easing: 'quadOut' })
            .call(() => {
                this.WoodenHit.active = false;
                this.WoodenHit.setPosition(this.hammerStartPosition);
                this.WoodenHit.setRotationFromEuler(this.hammerStartEuler.x, this.hammerStartEuler.y, this.hammerStartEuler.z);
            })
            .start();
    }

    private showMeritBubble() {
        if (!this.WoodenFish || !this.WoodenFish.parent) {
            return;
        }

        const parent = this.WoodenFish.parent;
        const fishPosition = this.WoodenFish.getPosition();
        const bubble = new Node('MeritBubble');
        const offsetX = Math.random() * 80 - 40;
        bubble.setPosition(fishPosition.x + offsetX, fishPosition.y + 330, fishPosition.z);
        parent.addChild(bubble);

        const transform = bubble.addComponent(UITransform);
        transform.setContentSize(180, 60);

        const label = bubble.addComponent(Label);
        label.string = '功德+1';
        label.fontSize = 34;
        label.lineHeight = 40;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);

        const opacity = bubble.addComponent(UIOpacity);
        opacity.opacity = 255;

        tween(bubble)
            .by(2.75, { position: new Vec3(0, 550, 0) }, { easing: 'quadOut' })
            .call(() => {
                bubble.destroy();
            })
            .start();

        tween(opacity)
            .to(0.75, { opacity: 0 })
            .start();
    }
}
