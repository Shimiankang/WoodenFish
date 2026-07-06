import { _decorator, Component, Node, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('home')
export class home extends Component {
    @property({ tooltip: "功德数", type: Label })
    public Count: Label = null;

    @property({ tooltip: "木鱼", type: Node })
    public WoodenFish: Node = null;
}


