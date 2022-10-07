import * as React from "react";
import * as pkg from "../../package";
import { connect } from 'react-redux';

import { List } from "../../../../react-common/components/controls/List";
import { Button } from "../../../../react-common/components/controls/Button";
import { Modal, ModalAction } from "../../../../react-common/components/controls/Modal";

import { AssetEditorState, GalleryView } from './store/assetEditorReducerState';
import { dispatchUpdateUserAssets } from './actions/dispatch';

import { AssetCardList } from "./assetCardList";
import { AssetTopbar } from "./assetTopbar";

interface AssetGalleryProps {
    view: GalleryView;
    galleryAssets: pxt.Asset[];
    userAssets: pxt.Asset[];
    disableCreateButton?: boolean;
    showAssetFieldView?: (asset: pxt.Asset, cb: (result: any) => void) => void;
    dispatchUpdateUserAssets?: () => void;
}

interface AssetGalleryState {
    showCreateModal?: boolean;
}

interface AssetOption {
    label: string;
    icon: string;
    handler: () => void;
}

class AssetGalleryImpl extends React.Component<AssetGalleryProps, AssetGalleryState> {
    private assetCreateOptions: AssetOption[];

    constructor(props: AssetGalleryProps) {
        super(props);
        this.state = { showCreateModal: false };

        this.assetCreateOptions = [
            { label: lf("Image"), icon: "picture", handler: this.getCreateAssetHandler(pxt.AssetType.Image) },
            { label: lf("Tile"), icon: "clone", handler: this.getCreateAssetHandler(pxt.AssetType.Tile) },
            { label: lf("Tilemap"), icon: "map", handler: this.getCreateAssetHandler(pxt.AssetType.Tilemap) },
            { label: lf("Animation"), icon: "video", handler: this.getCreateAssetHandler(pxt.AssetType.Animation) },
            { label: lf("Song"), icon: "music", handler: this.getCreateAssetHandler(pxt.AssetType.Song) }
        ]
    }

    protected showCreateModal = () => {
        this.setState({ showCreateModal: true });
    }

    protected hideCreateModal = () => {
        this.setState({ showCreateModal: false });
    }

    protected getCreateAssetHandler = (type: pxt.AssetType) => {
        return () => {
            pxt.tickEvent("assets.create", { type: type.toString() });

            const project = pxt.react.getTilemapProject();
            const asset = this.getEmptyAsset(type);

            this.hideCreateModal();
            this.props.showAssetFieldView(asset, (result: any) => {
                project.pushUndo();
                const name = result.meta?.displayName;
                switch (type) {
                    case pxt.AssetType.Image:
                        project.createNewProjectImage(result.bitmap, name); break;
                    case pxt.AssetType.Tile:
                        project.createNewTile(result.bitmap, null, name); break;
                    case pxt.AssetType.Tilemap:
                        project.createNewTilemapFromData(result.data, name); break;
                    case pxt.AssetType.Animation:
                        project.createNewAnimationFromData(result.frames, result.interval, name); break;
                    case pxt.AssetType.Song:
                        project.createNewSong(result.song, name); break;
                }
                pkg.mainEditorPkg().buildAssetsAsync()
                    .then(() => this.props.dispatchUpdateUserAssets());
            });
        }
    }

    protected getEmptyAsset(type: pxt.AssetType): pxt.Asset {
        const project = pxt.react.getTilemapProject();
        const asset = { type, id: "", internalID: 0, meta: { displayName: pxt.getDefaultAssetDisplayName(type) } } as pxt.Asset;
        switch (type) {
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
                (asset as pxt.ProjectImage).bitmap = new pxt.sprite.Bitmap(16, 16).data(); break
            case pxt.AssetType.Tilemap:
                const tilemap = asset as pxt.ProjectTilemap;
                tilemap.data = project.blankTilemap(16, 16, 16);
            case pxt.AssetType.Animation:
                const animation = asset as pxt.Animation;
                animation.frames = [new pxt.sprite.Bitmap(16, 16).data()];
                animation.interval = 200;
                break;
            case pxt.AssetType.Song:
                (asset as pxt.Song).song = pxt.assets.music.getEmptySong(2);
                break;

        }
        return asset;
    }

    render() {
        const { view, galleryAssets, userAssets, disableCreateButton } = this.props;
        const { showCreateModal } = this.state;
        const isBlocksProject = pkg.mainPkg?.config && pkg.mainPkg.getPreferredEditor() === pxt.BLOCKS_PROJECT_NAME;

        return <div className="asset-editor-gallery">
            <AssetTopbar />
            <div className={`asset-editor-card-list ${view !== GalleryView.User ? "hidden" : ""}`}>
                <AssetCardList assets={filterAssets(userAssets, isBlocksProject)}>
                    <Button className="create-new inverted"
                        disabled={disableCreateButton}
                        leftIcon="icon huge add circle"
                        title={lf("Create a new asset")}
                        ariaLabel={lf("Create a new asset")}
                        onClick={!disableCreateButton ? this.showCreateModal : undefined} />
                </AssetCardList>
            </div>
            <div className={`asset-editor-card-list ${view !== GalleryView.Gallery ? "hidden" : ""}`}>
                <AssetCardList assets={galleryAssets} />
            </div>
            {showCreateModal && <Modal
                className="asset-editor-create-dialog"
                onClose={this.hideCreateModal}
                title={lf("Create New Asset")}
                parentElement={document.getElementById("root")}>
                <div>{lf("Choose your asset type from the options below:")}</div>
                <List className="asset-editor-create-options">{
                    this.assetCreateOptions.map((opt, i) => {
                        return <Button
                            key={i}
                            className="asset-editor-create-button inverted"
                            leftIcon={`icon ${opt.icon}`}
                            label={opt.label}
                            title={lf("Create a new {0} asset", opt.label)}
                            ariaLabel={lf("Create a new {0} asset", opt.label)}
                            onClick={opt.handler} />
                    })
                }</List>
            </Modal>}
        </div>
    }
}
function filterAssets(assets: pxt.Asset[], includeTemporary: boolean) {
    return includeTemporary ? assets : assets.filter(asset => !!asset.meta.displayName)
}


function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return {
        ...ownProps,
        view: state.view,
        userAssets: state.assets,
        galleryAssets: state.galleryAssets
    }
}

const mapDispatchToProps = {
    dispatchUpdateUserAssets
};

export const AssetGallery = connect(mapStateToProps, mapDispatchToProps)(AssetGalleryImpl);
