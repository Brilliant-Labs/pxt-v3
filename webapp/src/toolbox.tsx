/// <reference path="../../localtypings/pxtarget.d.ts" />

import * as React from "react"
import * as data from "./data"
import * as editor from "./toolboxeditor"
import * as sui from "./sui"
import * as core from "./core"
import * as coretsx from "./coretsx";

import Util = pxt.Util;

export const enum CategoryNameID {
    Loops = "loops",
    Logic = "logic",
    Variables = "variables",
    Maths = "Math",
    Functions = "functions",
    Arrays = "arrays",
    Text = "text",
    Extensions = "addpackage"
}

// this is a supertype of pxtc.SymbolInfo (see partitionBlocks)
export interface BlockDefinition {
    qName?: string;
    name: string;
    pyQName?: string;
    pyName?: string;
    namespace?: string;
    type?: string;
    snippet?: string;
    snippetName?: string;
    pySnippet?: string;
    pySnippetName?: string;
    snippetOnly?: boolean;
    attributes: {
        block?: string;
        blockId?: string;
        blockNamespace?: string;
        color?: string;
        weight?: number;
        advanced?: boolean;
        jsDoc?: string;
        blockBuiltin?: boolean;
        deprecated?: boolean;
        blockHidden?: boolean;
        group?: string;
        subcategory?: string;
        topblockWeight?: number;
        help?: string;
        _def?: pxtc.ParsedBlockDef;
    };
    retType?: string;
    blockXml?: string;
    builtinBlock?: boolean;
    builtinField?: [string, string];
    parameters?: pxtc.ParameterDesc[];
}

export interface GroupDefinition {
    name: string;
    icon?: string;
    hasHelp?: boolean;
    blocks: BlockDefinition[];
}

export interface ButtonDefinition {
    name: string;
    type: "button";
    attributes: {
        blockId?: string;
        label?: string;
        weight?: number;
    }
    callback?: () => void;
}

export interface BuiltinCategoryDefinition {
    name: string;
    nameid: string;
    blocks: (BlockDefinition | ButtonDefinition)[];
    groups?: string[];
    attributes: pxtc.CommentAttrs;
    removed?: boolean;
    custom?: boolean; // Only add blocks defined in .blocks and don't query nsMap for more
    customClick?: (theEditor: editor.ToolboxEditor) => boolean; // custom handler
}

export interface ToolboxProps {
    editorname: string;
    parent: editor.ToolboxEditor;
}

export interface ToolboxState {
    showAdvanced?: boolean;
    showAdvanced1?: boolean;
    showAdvanced2?: boolean;
    showAdvanced3?: boolean;
    showAdvanced4?: boolean;
    showAdvanced5?: boolean;
    showAdvanced6?: boolean;
    showAdvanced7?: boolean;
    showAdvanced8?: boolean;
    showAdvanced9?: boolean
    visible?: boolean;
    loading?: boolean;
    selectedItem?: string;
    expandedItem?: string;
    height?: number;

    categories?: ToolboxCategory[];
    showSearchBox?: boolean;

    hasSearch?: boolean;
    focusSearch?: boolean;
    searchBlocks?: pxtc.service.SearchInfo[]; // block ids

    hasError?: boolean;

    shouldAnimate?: boolean;
}

const MONACO_EDITOR_NAME: string = "monaco";

export class Toolbox extends data.Component<ToolboxProps, ToolboxState> {

    private rootElement: HTMLElement;

    private selectedItem: CategoryItem;
    private selectedIndex: number;
    private items: ToolboxCategory[];

    constructor(props: ToolboxProps) {
        super(props);
        this.state = {
            categories: [],
            visible: false,
            loading: false,
            showAdvanced: false,
            showAdvanced1: false,
            showAdvanced2: false,
            showAdvanced3: false,
            showAdvanced4: false,
            showAdvanced5: false,
            showAdvanced6: false,
            showAdvanced7: false,
            showAdvanced8: false,
            showAdvanced9: false,
            shouldAnimate: !pxt.shell.getToolboxAnimation()
        }

        this.setSelection = this.setSelection.bind(this);
        this.advancedClicked = this.advancedClicked.bind(this);
        this.advancedClicked1 = this.advancedClicked1.bind(this);
        this.advancedClicked2 = this.advancedClicked2.bind(this);
        this.advancedClicked3 = this.advancedClicked3.bind(this);
        this.advancedClicked4 = this.advancedClicked4.bind(this);
        this.advancedClicked5 = this.advancedClicked5.bind(this);
        this.advancedClicked6 = this.advancedClicked6.bind(this);
        this.advancedClicked7 = this.advancedClicked7.bind(this);
        this.advancedClicked8 = this.advancedClicked8.bind(this);
        this.advancedClicked9 = this.advancedClicked9.bind(this);
        this.recoverToolbox = this.recoverToolbox.bind(this);
    }

    getElement() {
        return this.rootElement;
    }

    hide() {
        this.setState({ visible: false })
    }

    showLoading() {
        this.setState({ visible: true, loading: true });
    }

    show() {
        this.setState({ visible: true })
    }

    setSelectedItem(item: CategoryItem) {
        this.selectedItem = item;
    }

    setPreviousItem() {
        if (this.selectedIndex > 0) {
            const newIndex = --this.selectedIndex;
            // Check if the previous item has a subcategory
            let previousItem = this.items[newIndex];
            this.setSelection(previousItem, newIndex);
        } else if (this.state.showSearchBox) {
            // Focus the search box if it exists
            const searchBox = this.refs.searchbox as ToolboxSearch;
            if (searchBox) searchBox.focus();
        }
    }

    setNextItem() {
        if (this.items.length - 1 > this.selectedIndex) {
            const newIndex = ++this.selectedIndex;
            this.setSelection(this.items[newIndex], newIndex);
        }
    }

    setSearch() {
        // Focus the search box if it exists
        const searchBox = this.refs.searchbox as ToolboxSearch;
        if (searchBox) searchBox.focus();
    }

    clear() {
        this.clearSelection();
        this.selectedIndex = 0;
        this.selectedTreeRow = undefined;
    }

    clearSelection() {
        this.setState({ selectedItem: undefined, focusSearch: false });
    }

    clearExpandedItem() {
        this.setState({ expandedItem: undefined });
    }

    clearSearch() {
        this.setState({ hasSearch: false, searchBlocks: undefined, focusSearch: false });
    }

    setSelection(treeRow: ToolboxCategory, index: number, force?: boolean) {
        const { editorname, parent } = this.props;
        const { nameid, subns, customClick } = treeRow;

        pxt.tickEvent(`${editorname}.toolbox.click`, undefined, { interactiveConsent: true });

        let id = subns ? nameid + subns : nameid;

        if (this.state.selectedItem == id && !force) {
            this.clearSelection();

            // Hide flyout
            this.closeFlyout();
            if (parent.parent.state?.accessibleBlocks) {
                Blockly.navigation.setState(Blockly.navigation.STATE_WS);
            }
        } else {
            let handled = false;
            if (parent.parent.state?.accessibleBlocks) {
                Blockly.navigation.setState(Blockly.navigation.STATE_TOOLBOX);
            }
            if (customClick) {
                handled = customClick(parent);
                if (handled) return;
            }

            if (!handled) {
                this.setState({ selectedItem: id, expandedItem: nameid, focusSearch: false })
                this.selectedIndex = index;
                this.selectedTreeRow = treeRow;
                //if (treeRow.advanced && !this.state.showAdvanced) this.showAdvanced();

                if (!customClick) {
                    // Show flyout
                    this.showFlyout(treeRow);
                }
            }
        }
    }

    focus() {
        if (!this.rootElement) return;
        if (this.selectedItem && this.selectedItem.getTreeRow()) {
            // Focus the selected item
            const selectedItem = this.selectedItem.props.treeRow;
            const selectedItemIndex = this.items.indexOf(selectedItem);
            this.setSelection(selectedItem, selectedItemIndex, true);
        } else {
            // Focus first item in the toolbox
            this.selectFirstItem();
        }
    }

    selectFirstItem() {
        if (this.items[0]) {
            this.setSelection(this.items[0], 0, true);
        }
    }

    moveFocusToFlyout() {
        const { parent } = this.props;
        parent.moveFocusToFlyout();
    }

    UNSAFE_componentWillReceiveProps(props: ToolboxProps) {
        // if leaving monaco, mark toolbox animation as shown. also
        // handles full screen sim, where we hide the toolbox via css
        // without re-rendering, which will trigger the animation again
        if ((this.props.editorname == MONACO_EDITOR_NAME && props.editorname != MONACO_EDITOR_NAME)
            || (props.editorname == MONACO_EDITOR_NAME && props.parent.parent.state.fullscreen)
            && this.state.shouldAnimate) {
            pxt.shell.setToolboxAnimation();
            this.setState({ shouldAnimate: false });
        }
    }

    componentDidUpdate(prevProps: ToolboxProps, prevState: ToolboxState) {
        if (prevState.visible != this.state.visible
            || prevState.loading != this.state.loading
            || prevState.showAdvanced != this.state.showAdvanced
            || prevState.showAdvanced1 != this.state.showAdvanced1
            || prevState.showAdvanced2 != this.state.showAdvanced2
            || prevState.showAdvanced3 != this.state.showAdvanced3
            || prevState.showAdvanced4 != this.state.showAdvanced4
            || prevState.showAdvanced5 != this.state.showAdvanced5
            || prevState.showAdvanced6 != this.state.showAdvanced6
            || prevState.showAdvanced7 != this.state.showAdvanced7
            || prevState.showAdvanced8 != this.state.showAdvanced8
            || prevState.showAdvanced9 != this.state.showAdvanced9
            || this.state.expandedItem != prevState.expandedItem) {
            this.props.parent.resize();
        }
        if (this.state.hasSearch && this.state.searchBlocks != prevState.searchBlocks) {
            // Referesh search items
            this.refreshSearchItem();
        } else if (prevState.hasSearch && !this.state.hasSearch && this.state.selectedItem == 'search') {
            // No more search
            this.closeFlyout();
        }
    }

    componentDidCatch(error: any, info: any) {
        // Log what happened
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.toolbox.crashed`, { error: error });

        // Update error state
        this.setState({ hasError: true });
    }

    componentWillUnmount() {
        if (this.props.editorname == MONACO_EDITOR_NAME) {
            pxt.shell.setToolboxAnimation();
        }
    }

    recoverToolbox() {
        // Recover from above error state
        this.setState({ hasError: false });
    }

    advancedClicked() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced();
    }

    advancedClicked1() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced1();
    }

    advancedClicked2() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced2();
    }

    advancedClicked3() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced3();
    }

    advancedClicked4() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced4();
    }

    advancedClicked5() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced5();
    }

    advancedClicked6() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced6();
    }

    advancedClicked7() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced7();
    }

    advancedClicked8() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced8();
    }

    advancedClicked9() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced9();
    }

    showAdvanced() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced: !this.state.showAdvanced });
    }

    showAdvanced1() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced1: !this.state.showAdvanced1 });
    }

    showAdvanced2() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced2: !this.state.showAdvanced2 });
    }

    showAdvanced3() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced3: !this.state.showAdvanced3 });
    }

    showAdvanced4() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced4: !this.state.showAdvanced4 });
    }

    showAdvanced5() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced5: !this.state.showAdvanced5 });
    }

    showAdvanced6() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced6: !this.state.showAdvanced6 });
    }

    showAdvanced7() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced7: !this.state.showAdvanced7 });
    }

    showAdvanced8() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced8: !this.state.showAdvanced8 });
    }

    showAdvanced9() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced9: !this.state.showAdvanced9 });
    }

    getSearchBlocks(): BlockDefinition[] {
        const { parent } = this.props;
        const { searchBlocks } = this.state;
        return searchBlocks.map(searchResult => {
            return {
                name: searchResult.qName,
                attributes: {
                    blockId: searchResult.id
                },
                builtinBlock: searchResult.builtinBlock,
                builtinField: searchResult.field
            }
        });
    }

    refreshSelection() {
        const { parent } = this.props;
        if (!this.state.selectedItem || !this.selectedTreeRow) return;
        if (this.selectedTreeRow.customClick) {
            this.selectedTreeRow.customClick(parent);
        } else {
            this.showFlyout(this.selectedTreeRow);
        }
    }

    refreshSearchItem() {
        const searchTreeRow = ToolboxSearch.getSearchTreeRow();
        this.showFlyout(searchTreeRow);
    }

    private selectedTreeRow: ToolboxCategory;
    private showFlyout(treeRow: ToolboxCategory) {
        const { parent } = this.props;
        // const t0 = performance.now();
        parent.showFlyout(treeRow);
        // const t1 = performance.now();
        // pxt.debug("perf: call to showFlyout took " + (t1 - t0) + " milliseconds.");
    }

    closeFlyout() {
        const { parent } = this.props;
        parent.closeFlyout();
    }

    hasAdvancedCategories(group: string) {
        const { categories } = this.state;
        switch (group) {
            case "1001":
                return categories.some(category => category.labelLineWidth === "1001");
            case "1002":
                return categories.some(category => category.labelLineWidth === "1002");
            case "1003":
                return categories.some(category => category.labelLineWidth === "1003");
            case "1004":
                return categories.some(category => category.labelLineWidth === "1004");
            case "1005":
                return categories.some(category => category.labelLineWidth === "1005");
            case "1006":
                return categories.some(category => category.labelLineWidth === "1006");
            case "1007":
                return categories.some(category => category.labelLineWidth === "1007");
            case "1008":
                return categories.some(category => category.labelLineWidth === "1008");
            case "1009":
                return categories.some(category => category.labelLineWidth === "1009");
            case "0":
                return categories.some(category => category.advanced && 
                    (category.labelLineWidth !== "1001" &&
                        category.labelLineWidth !== "1002" &&
                        category.labelLineWidth !== "1003" &&
                        category.labelLineWidth !== "1004" &&
                        category.labelLineWidth !== "1005" &&
                        category.labelLineWidth !== "1006" &&
                        category.labelLineWidth !== "1007" &&
                        category.labelLineWidth !== "1008" &&
                        category.labelLineWidth !== "1009"
                        ));
                default:
                    return categories.some(category => category.advanced && 
                        (category.labelLineWidth !== "1001" &&
                            category.labelLineWidth !== "1002" &&
                            category.labelLineWidth !== "1003" &&
                            category.labelLineWidth !== "1004" &&
                            category.labelLineWidth !== "1005" &&
                            category.labelLineWidth !== "1006" &&
                            category.labelLineWidth !== "1007" &&
                            category.labelLineWidth !== "1008" &&
                            category.labelLineWidth !== "1009"
                            ));
                    }
    }

    getNonAdvancedCategories() {
        const { categories } = this.state;
        return categories.filter(category => !category.advanced);
    }

    getAdvancedCategories(group: string) {
        const { categories } = this.state;
        switch (group) {
            case "1001":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1001"));
            case "1002":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1002"));
            case "1003":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1003"));
            case "1004":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1004"));
            case "1005":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1005"));
            case "1006":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1006"));
            case "1007":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1007"));
            case "1008":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1008"));
            case "1009":
                return categories.filter(category => category.advanced && (category.labelLineWidth === "1009"));
            case "0":
                return categories.filter(category => category.advanced && 
                        (category.labelLineWidth !== "1001" &&
                            category.labelLineWidth !== "1002" &&
                            category.labelLineWidth !== "1003" &&
                            category.labelLineWidth !== "1004" &&
                            category.labelLineWidth !== "1005" &&
                            category.labelLineWidth !== "1006" &&
                            category.labelLineWidth !== "1007" &&
                            category.labelLineWidth !== "1008" &&
                            category.labelLineWidth !== "1009"
                            ));
                    ;
            default:
                return categories.filter(category => category.advanced && 
                    (category.labelLineWidth !== "1001" &&
                        category.labelLineWidth !== "1002" &&
                        category.labelLineWidth !== "1003" &&
                        category.labelLineWidth !== "1004" &&
                        category.labelLineWidth !== "1005" &&
                        category.labelLineWidth !== "1006" &&
                        category.labelLineWidth !== "1007" &&
                        category.labelLineWidth !== "1008" &&
                        category.labelLineWidth !== "1009"
                        ));
        }
    }

    private getAllCategoriesList(visibleOnly?: boolean): ToolboxCategory[] {
        const { categories, hasSearch, expandedItem } = this.state;
        const categoriesList: ToolboxCategory[] = [];
        if (hasSearch) categoriesList.push(ToolboxSearch.getSearchTreeRow());
        categories.forEach(category => {
            categoriesList.push(category);
            if (category.subcategories &&
                (!visibleOnly || visibleOnly && category.nameid == expandedItem)) {
                category.subcategories.forEach(subcategory => {
                    categoriesList.push(subcategory);
                })
            }
        })
        return categoriesList;
    }

    shouldComponentUpdate(nextProps: ToolboxProps, nextState: ToolboxState) {
        if (this.state != nextState) return true;
        return false;
    }

    handleRootElementRef = (c: HTMLDivElement) => {
        this.rootElement = c;
    }

    isRtl() {
        const { editorname } = this.props;
        return editorname == 'monaco' ? false : Util.isUserLanguageRtl();
    }

    renderCore() {
        const { editorname, parent } = this.props;
        const { showAdvanced, visible, loading, selectedItem, expandedItem, hasSearch, showSearchBox, hasError } = this.state;
        if (!visible) return <div style={{ display: 'none' }} />

        const theme = pxt.appTarget.appTheme;
        const tutorialOptions = parent.parent.state.tutorialOptions;
        const inTutorial = !!tutorialOptions && !!tutorialOptions.tutorial
        const hasTopBlocks = !!theme.topBlocks && !inTutorial;

        if (loading || hasError) return <div>
            <div className="blocklyTreeRoot">
                <div className="blocklyTreeRow" style={{ opacity: 0 }} />
            </div>
            {loading ? <div className="ui active dimmer">
                <div className="ui loader indeterminate" />
            </div> : undefined}
            {hasError ? <div className="ui">
                {lf("Toolbox crashed..")}
                <sui.Button icon='refresh' onClick={this.recoverToolbox}
                    text={lf("Reload")} className='fluid' />
            </div> : undefined}
        </div>;

        const hasAdvanced = this.hasAdvancedCategories("");
        const hasAdvanced1 = this.hasAdvancedCategories("1001");
        const hasAdvanced2 = this.hasAdvancedCategories("1002");
        const hasAdvanced3 = this.hasAdvancedCategories("1003");
        const hasAdvanced4 = this.hasAdvancedCategories("1004");
        const hasAdvanced5 = this.hasAdvancedCategories("1005");
        const hasAdvanced6 = this.hasAdvancedCategories("1006");
        const hasAdvanced7 = this.hasAdvancedCategories("1007");
        const hasAdvanced8 = this.hasAdvancedCategories("1008");
        const hasAdvanced9 = this.hasAdvancedCategories("1009");

        let nonAdvancedCategories = this.getNonAdvancedCategories();
        const advancedCategories = hasAdvanced ? this.getAdvancedCategories("") : [];
        const advancedCategories1 = hasAdvanced ? this.getAdvancedCategories("1001") : [];
        const advancedCategories2 = hasAdvanced ? this.getAdvancedCategories("1002") : [];
        const advancedCategories3 = hasAdvanced ? this.getAdvancedCategories("1003") : [];
        const advancedCategories4 = hasAdvanced ? this.getAdvancedCategories("1004") : [];
        const advancedCategories5 = hasAdvanced ? this.getAdvancedCategories("1005") : [];
        const advancedCategories6 = hasAdvanced ? this.getAdvancedCategories("1006") : [];
        const advancedCategories7 = hasAdvanced ? this.getAdvancedCategories("1007") : [];
        const advancedCategories8 = hasAdvanced ? this.getAdvancedCategories("1008") : [];
        const advancedCategories9 = hasAdvanced ? this.getAdvancedCategories("1009") : [];

        this.items = this.getAllCategoriesList();

        const searchTreeRow = ToolboxSearch.getSearchTreeRow();
        const topBlocksTreeRow = {
            nameid: 'topblocks',
            name: lf("{id:category}Basic"),
            color: pxt.toolbox.getNamespaceColor('topblocks'),
            icon: pxt.toolbox.getNamespaceIcon('topblocks')
        };

        const appTheme = pxt.appTarget.appTheme;
        const classes = sui.cx([
            'pxtToolbox',
            appTheme.invertedToolbox ? 'invertedToolbox' : '',
            appTheme.coloredToolbox ? 'coloredToolbox' : ''
        ])

        let index = 0;
        let topRowIndex = 0; // index of top-level rows for animation
        return <div ref={this.handleRootElementRef} className={classes} id={`${editorname}EditorToolbox`}>
            <ToolboxStyle categories={this.items} />
            {showSearchBox ? <ToolboxSearch ref="searchbox" parent={parent} toolbox={this} editorname={editorname} /> : undefined}
            <div className="blocklyTreeRoot">
                <div role="tree">
                    {hasSearch ? <CategoryItem key={"search"} toolbox={this} index={index++} selected={selectedItem == "search"} treeRow={searchTreeRow} onCategoryClick={this.setSelection} /> : undefined}
                    {hasTopBlocks ? <CategoryItem key={"topblocks"} toolbox={this} selected={selectedItem == "topblocks"} treeRow={topBlocksTreeRow} onCategoryClick={this.setSelection} /> : undefined}
                    {nonAdvancedCategories.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection} topRowIndex={topRowIndex++} shouldAnimate={this.state.shouldAnimate}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid + subTreeRow.subns} index={index++} toolbox={this} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    ))}
                    {hasAdvanced ? <TreeSeparator key="advancedseparator" /> : undefined}
                    {hasAdvanced ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: pxt.toolbox.advancedTitle(), color: pxt.toolbox.getNamespaceColor('advanced'), icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked} topRowIndex={topRowIndex++} /> : undefined}
                    {showAdvanced ? advancedCategories.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced1 ? <TreeSeparator key="advancedseparator1" /> : undefined}
                    {hasAdvanced1 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "b.Board", color: "#9E4894", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked1} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced1 ? advancedCategories1.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced2 ? <TreeSeparator key="advancedseparator2" /> : undefined}
                    {hasAdvanced2 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "Clickboards: Sensors", color: "#33BEBB", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked2} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced2 ? advancedCategories2.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced3 ? <TreeSeparator key="advancedseparator3" /> : undefined}
                    {hasAdvanced3 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "Clickboards: Buttons & Switches", color: "#F4B820", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked3} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced3 ? advancedCategories3.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced4 ? <TreeSeparator key="advancedseparator4" /> : undefined}
                    {hasAdvanced4 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "Clickboards: Wireless", color: "#FF2F92", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked4} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced4 ? advancedCategories4.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced5 ? <TreeSeparator key="advancedseparator5" /> : undefined}
                    {hasAdvanced5 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "Clickboards: Motors", color: "#FF2F92", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked5} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced5 ? advancedCategories5.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced6 ? <TreeSeparator key="advancedseparator6" /> : undefined}
                    {hasAdvanced6 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "Clickboards: Display & LED", color: "#D400D4", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked6} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced6 ? advancedCategories6.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced7 ? <TreeSeparator key="advancedseparator7" /> : undefined}
                    {hasAdvanced7 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "Clickboards: Power", color: "#FF2F92", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked7} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced7 ? advancedCategories7.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced8 ? <TreeSeparator key="advancedseparator8" /> : undefined}
                    {hasAdvanced8 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "Cybersecurity", color: "#FF2F92", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked8} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced8 ? advancedCategories8.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                    {hasAdvanced9 ? <TreeSeparator key="advancedseparator9" /> : undefined}
                    {hasAdvanced9 ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: "External Sensors", color: "#0fbc11", icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked9} topRowIndex={topRowIndex++} /> : undefined}
                    {this.state.showAdvanced9 ? advancedCategories9.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}

                </div>
            </div>
        </div>
    }
}

export interface CategoryItemProps extends TreeRowProps {
    toolbox: Toolbox;
    childrenVisible?: boolean;
    onCategoryClick?: (treeRow: ToolboxCategory, index: number) => void;
    index?: number;
    topRowIndex?: number;
}

export interface CategoryItemState {
    selected?: boolean;
}

export class CategoryItem extends data.Component<CategoryItemProps, CategoryItemState> {
    private treeRowElement: TreeRow;

    constructor(props: CategoryItemProps) {
        super(props);
        this.state = {
            selected: props.selected
        }

        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    getTreeRow() {
        return this.treeRowElement;
    }

    UNSAFE_componentWillReceiveProps(nextProps: CategoryItemProps) {
        const newState: CategoryItemState = {};
        if (nextProps.selected != undefined) {
            newState.selected = nextProps.selected;
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    componentDidUpdate(prevProps: CategoryItemProps, prevState: CategoryItemState) {
        const { toolbox } = this.props;
        if (this.state.selected) {
            this.props.toolbox.setSelectedItem(this);
            if (!toolbox.state.focusSearch && !coretsx.dialogIsShowing()) this.focusElement();
        }
    }

    focusElement() {
        this.treeRowElement.focus();
    }

    handleClick(e: React.MouseEvent<any>) {
        const { treeRow, onCategoryClick, index } = this.props;
        if (onCategoryClick) onCategoryClick(treeRow, index);

        e.preventDefault();
        e.stopPropagation();
    }

    handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
        const { toolbox } = this.props;
        const isRtl = Util.isUserLanguageRtl();

        const accessibleBlocksEnabled = (Blockly.getMainWorkspace() as any).keyboardAccessibilityMode;
        const blocklyNavigationState = (Blockly.navigation as any).currentState_ as number;
        const keyMap: { [key: string]: number } = {
            "DOWN": accessibleBlocksEnabled ? 83 : 40, // 'S' || down arrow
            "UP": accessibleBlocksEnabled ? 87 : 38, // 'W' || up arrow
            "LEFT": accessibleBlocksEnabled ? 65 : 37, // 'A' || left arrow
            "RIGHT": accessibleBlocksEnabled ? 68 : 39 // 'D' || right arrow
        }

        const charCode = core.keyCodeFromEvent(e);
        if (!accessibleBlocksEnabled || blocklyNavigationState != 1) {
            if (charCode == keyMap["DOWN"]) {
                this.nextItem();
            } else if (charCode == keyMap["UP"]) {
                this.previousItem();
            } else if ((charCode == keyMap["RIGHT"] && !isRtl)
                || (charCode == keyMap["LEFT"] && isRtl)) {
                // Focus inside flyout
                toolbox.moveFocusToFlyout();
            } else if (charCode == 27) { // ESCAPE
                // Close the flyout
                toolbox.closeFlyout();
            } else if (charCode == core.ENTER_KEY || charCode == core.SPACE_KEY) {
                sui.fireClickOnEnter.call(this, e);
            } else if (charCode == core.TAB_KEY
                || charCode == 37 /* Left arrow key */
                || charCode == 39 /* Left arrow key */
                || charCode == 17 /* Ctrl Key */
                || charCode == 16 /* Shift Key */
                || charCode == 91 /* Cmd Key */) {
                // Escape tab and shift key
            } else if (!accessibleBlocksEnabled) {
                toolbox.setSearch();
            }
        } else if (accessibleBlocksEnabled && blocklyNavigationState == 1
            && ((charCode == keyMap["LEFT"] && !isRtl)
            || (charCode == keyMap["RIGHT"] && isRtl))) {
            this.focusElement();
            e.stopPropagation();
        }
    }

    previousItem() {
        const { toolbox, childrenVisible } = this.props;
        const editorname = toolbox.props.editorname;

        pxt.tickEvent(`${editorname}.toolbox.keyboard.prev"`, undefined, { interactiveConsent: true });
        toolbox.setPreviousItem();
    }

    nextItem() {
        const { toolbox, childrenVisible } = this.props;
        const editorname = toolbox.props.editorname;

        pxt.tickEvent(`${editorname}.toolbox.keyboard.next"`, undefined, { interactiveConsent: true });
        toolbox.setNextItem();
    }

    handleTreeRowRef = (c: TreeRow) => {
        this.treeRowElement = c;
    }

    renderCore() {
        const { toolbox, childrenVisible } = this.props;
        const { selected } = this.state;

        return <TreeItem>
            <TreeRow ref={this.handleTreeRowRef} isRtl={toolbox.isRtl()} {...this.props} selected={selected}
                onClick={this.handleClick} onKeyDown={this.handleKeyDown} />
            <TreeGroup visible={childrenVisible}>
                {this.props.children}
            </TreeGroup>
        </TreeItem>
    }
}

export interface ToolboxCategory {
    nameid: string;
    subns?: string;

    name?: string;
    color?: string;
    icon?: string;

    groups?: string[];
    groupIcons?: string[];
    groupHelp?: string[];
    labelLineWidth?: string;

    blocks?: BlockDefinition[];
    subcategories?: ToolboxCategory[];

    customClick?: (theEditor: editor.ToolboxEditor) => boolean;
    advanced?: boolean; /*@internal*/
}

export interface TreeRowProps {
    treeRow: ToolboxCategory;
    onClick?: (e: React.MouseEvent<any>) => void;
    onKeyDown?: (e: React.KeyboardEvent<any>) => void;
    selected?: boolean;
    isRtl?: boolean;
    topRowIndex?: number;
    shouldAnimate?: boolean;
}

export class TreeRow extends data.Component<TreeRowProps, {}> {

    private treeRow: HTMLElement;
    private baseAnimationDelay: number = 1;
    private animationDelay: number = 0.15;

    constructor(props: TreeRowProps) {
        super(props);
        this.state = {
        }

        this.onmouseenter = this.onmouseenter.bind(this);
        this.onmouseleave = this.onmouseleave.bind(this);
    }

    focus() {
        if (this.treeRow) this.treeRow.focus();
    }

    getProperties() {
        const { treeRow } = this.props;
        return treeRow;
    }

    onmouseenter() {
        const appTheme = pxt.appTarget.appTheme;
        const metaColor = this.getMetaColor();
        const invertedMultipler = appTheme.blocklyOptions
            && appTheme.blocklyOptions.toolboxOptions
            && appTheme.blocklyOptions.toolboxOptions.invertedMultiplier || 0.3;

        if (appTheme.invertedToolbox) {
            this.treeRow.style.backgroundColor = pxt.toolbox.fadeColor(metaColor || '#ddd', invertedMultipler, false);
        }
    }

    onmouseleave() {
        const appTheme = pxt.appTarget.appTheme;
        const metaColor = this.getMetaColor();
        if (appTheme.invertedToolbox) {
            this.treeRow.style.backgroundColor = (metaColor || '#ddd');
        }
    }

    getMetaColor() {
        const { color } = this.props.treeRow;
        return pxt.toolbox.convertColor(color) || pxt.toolbox.getNamespaceColor('default');
    }

    handleTreeRowRef = (c: HTMLDivElement) => {
        this.treeRow = c;
    }

    renderCore() {
        const { selected, onClick, onKeyDown, isRtl, topRowIndex } = this.props;
        const { nameid, subns, name, icon } = this.props.treeRow;
        const appTheme = pxt.appTarget.appTheme;
        const metaColor = this.getMetaColor();

        const invertedMultipler = appTheme.blocklyOptions
            && appTheme.blocklyOptions.toolboxOptions
            && appTheme.blocklyOptions.toolboxOptions.invertedMultiplier || 0.3;

        let treeRowStyle: React.CSSProperties = {
            paddingLeft: '0px'
        }
        let treeRowClass = 'blocklyTreeRow';
        if (appTheme.invertedToolbox) {
            // Inverted toolbox
            treeRowStyle.backgroundColor = (metaColor || '#ddd');
            treeRowStyle.color = '#fff';
        } else {
            if (appTheme.coloredToolbox) {
                // Colored toolbox
                treeRowStyle.color = `${metaColor}`;
            }
            const border = `8px solid ${metaColor}`;
            if (isRtl) {
                treeRowStyle.borderRight = border;
            } else {
                treeRowStyle.borderLeft = border;
            }
            if (topRowIndex && this.props.shouldAnimate) {
                treeRowStyle.animationDelay = `${(topRowIndex * this.animationDelay) + this.baseAnimationDelay}s`;
                treeRowClass += ' blocklyTreeAnimate';
            }
        }

        // Selected
        if (selected) {
            treeRowClass += ' blocklyTreeSelected';
            if (appTheme.invertedToolbox) {
                treeRowStyle.backgroundColor = `${pxt.toolbox.fadeColor(metaColor, invertedMultipler, false)}`;
            } else {
                treeRowStyle.backgroundColor = (metaColor || '#ddd');
            }
            treeRowStyle.color = '#fff';
        }

        // Icon
        const iconClass = `blocklyTreeIcon${subns ? 'more' : icon ? (nameid || icon).toLowerCase() : 'Default'}`.replace(/\s/g, '');
        let iconContent = subns ? pxt.toolbox.getNamespaceIcon('more') : icon || pxt.toolbox.getNamespaceIcon('default');
        let iconImageStyle: JSX.Element;
        if (iconContent.length > 1) {
            // It's probably an image icon, and not an icon code
            iconImageStyle = <style>
                {`.blocklyTreeIcon.${iconClass} {
                    background-image: url("${Util.pathJoin(pxt.webConfig.commitCdnUrl, encodeURI(icon))}")!important;
                    width: 30px;
                    height: 100%;
                    background-size: 20px !important;
                    background-repeat: no-repeat !important;
                    background-position: 50% 50% !important;
                }`}
            </style>
            iconContent = undefined;
        }
        const rowTitle = name ? name : Util.capitalize(subns || nameid);

        return <div role="button" ref={this.handleTreeRowRef} className={treeRowClass}
            style={treeRowStyle} tabIndex={0}
            aria-label={lf("Toggle category {0}", rowTitle)} aria-expanded={selected}
            onMouseEnter={this.onmouseenter} onMouseLeave={this.onmouseleave}
            onClick={onClick} onContextMenu={onClick} onKeyDown={onKeyDown ? onKeyDown : sui.fireClickOnEnter}>
            <span className="blocklyTreeIcon" role="presentation"></span>
            {iconImageStyle}
            <span style={{ display: 'inline-block' }} className={`blocklyTreeIcon ${iconClass}`} role="presentation">{iconContent}</span>
            <span className="blocklyTreeLabel">{rowTitle}</span>
        </div>
    }
}

export class TreeSeparator extends data.Component<{}, {}> {
    renderCore() {
        return <TreeItem>
            <div className="blocklyTreeSeparator">
                <span style={{ display: 'inline-block' }} role="presentation"></span>
            </div>
        </TreeItem>
    }
}

export interface TreeItemProps {
    selected?: boolean;
    children?: any;
}

export class TreeItem extends data.Component<TreeItemProps, {}> {
    renderCore() {
        const { selected } = this.props;
        return <div role="treeitem" aria-selected={selected}>
            {this.props.children}
        </div>
    }
}

export interface TreeGroupProps {
    visible?: boolean;
    children?: any;
}

export class TreeGroup extends data.Component<TreeGroupProps, {}> {
    renderCore() {
        const { visible } = this.props;
        if (!this.props.children) return <div />;

        return <div role="tree" style={{ backgroundPosition: '0px 0px', 'display': visible ? '' : 'none' }}>
            {this.props.children}
        </div>
    }
}


export interface ToolboxSearchProps {
    parent: editor.ToolboxEditor;
    editorname: string;
    toolbox: Toolbox;
}

export interface ToolboxSearchState {
    searchAccessibilityLabel?: string;
}

export class ToolboxSearch extends data.Component<ToolboxSearchProps, ToolboxSearchState> {

    constructor(props: ToolboxSearchProps) {
        super(props);
        this.state = {
        }

        this.searchImmediate = this.searchImmediate.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleChange = this.handleChange.bind(this);
    }

    static getSearchTreeRow(): ToolboxCategory {
        return {
            nameid: 'search',
            name: lf("{id:category}Search"),
            color: pxt.toolbox.getNamespaceColor('search'),
            icon: pxt.toolbox.getNamespaceIcon('search')
        }
    }

    private search = Util.debounce(() => {
        this.searchImmediate();
    }, 300, false);

    handleChange() {
        this.search();
    }

    handleKeyDown(e: React.KeyboardEvent<any>) {
        const { toolbox } = this.props;
        let charCode = (typeof e.which == "number") ? e.which : e.keyCode
        if (charCode === 40 /* Down Key */) {
            // Select first item in the toolbox
            toolbox.selectFirstItem();
        }
    }

    focus() {
        (this.refs.searchInput as HTMLInputElement).focus();
    }

    searchImmediate() {
        const { parent, toolbox, editorname } = this.props;
        const searchTerm = (this.refs.searchInput as HTMLInputElement).value;

        let searchAccessibilityLabel = '';
        let hasSearch = false;

        pxt.tickEvent(`${editorname}.search`, undefined, { interactiveConsent: true });

        // Execute search
        parent.searchAsync(searchTerm)
            .then((blocks) => {
                if (blocks.length == 0) {
                    searchAccessibilityLabel = lf("No search results...");
                } else {
                    searchAccessibilityLabel = lf("{0} result matching '{1}'", blocks.length, searchTerm.toLowerCase());
                }
                hasSearch = searchTerm != '';

                const newState: ToolboxState = {};
                newState.hasSearch = hasSearch;
                newState.searchBlocks = blocks;
                newState.focusSearch = true;
                if (hasSearch) newState.selectedItem = 'search';
                toolbox.setState(newState);

                this.setState({ searchAccessibilityLabel: searchAccessibilityLabel });
            });
    }

    renderCore() {
        const { searchAccessibilityLabel } = this.state;
        return <div id="blocklySearchArea">
            <div id="blocklySearchInput" className="ui fluid icon input" role="search">
                <input ref="searchInput" type="text" placeholder={lf("Search...")}
                    onFocus={this.searchImmediate} onKeyDown={this.handleKeyDown} onChange={this.handleChange}
                    id="blocklySearchInputField" className="blocklySearchInputField"
                    aria-label={lf("Search")}
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                <i className="search icon" role="presentation" aria-hidden="true"></i>
                <div className="accessible-hidden" id="blocklySearchLabel" aria-live="polite"> {searchAccessibilityLabel} </div>
            </div>
        </div>
    }
}

interface ToolboxTrashIconProps {
    flyoutOnly?: boolean;
}

export class ToolboxTrashIcon extends data.Component<ToolboxTrashIconProps, {}> {
    constructor(props: ToolboxTrashIconProps) {
        super(props);
    }

    getStyle() {
        let style: any = { opacity: 0, display: 'none' };
        if (this.props.flyoutOnly) {
            let flyout = document.querySelector('.blocklyFlyout');
            if (flyout) {
                style["left"] = (flyout.clientWidth / 2);
                style["transform"] = "translateX(-45%)";
            }
        }
        return style;
    }

    renderCore() {
        return <div id="blocklyTrashIcon" style={this.getStyle()}>
            <i className="trash icon" aria-hidden="true"></i>
        </div>
    }
}

interface ToolboxStyleProps {
    categories: ToolboxCategory[];
}

export class ToolboxStyle extends data.Component<ToolboxStyleProps, {}> {
    renderCore() {
        const { categories } = this.props;
        // Add inline CSS for each category used so that the tutorial engine is able to render blocks
        // and assosiate them with a specific category
        return <style>
            {categories.filter(c => !!c.color).map(category =>
                `span.docs.inlineblock.${category.nameid.toLowerCase()} {
                    background-color: ${category.color};
                    border-color: ${pxt.toolbox.fadeColor(category.color, 0.1, false)};
                }`
            )}
        </style>
    }
}
