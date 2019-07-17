import { Component, Injectable } from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlattener, MatTreeFlatDataSource } from '@angular/material/tree';
import { of as ofObservable, Observable, BehaviorSubject } from 'rxjs';



/**
 * Node for Country 
 */
export class CountriesNode {
  children: CountriesNode[];
  place: string;
}

/** Flat Country (or place) node with expandable and level information */
export class CountriesFlatNode {
  place: string;
  level: number;
  expandable: boolean;
}

/**
 * The Json object for Country list data.
 */
const TREE_DATA = {
  'South America ': {
    Venezuela: ['Caracas', 'Maracaibo'],
    Brazil: ['Sao Paulo', 'Rio de Janeiro'],
    Argentina: ['Buenos Aires', 'Cordoba']

  },
  'North America': {
    USA: ['New York', 'Los Angeles'],
    Mexico: ['Mexico City', 'Guadalajara'],
    Canada: ['Toronto', 'Vancouver']

  }
};



/**
 * Checklist database, it can build a tree structured Json object.
 * Each node in Json object represents a Country or a city.
 * If a node is a city, it has children places and new place can be added under the city.
 */
@Injectable()
export class ChecklistDatabase {
  dataChange: BehaviorSubject<CountriesNode[]> = new BehaviorSubject<CountriesNode[]>([]);

  get data(): CountriesNode[] { return this.dataChange.value; }

  constructor() {
    this.initialize();
  }

  initialize() {
    // Build the tree nodes from Json object. The result is a list of `CountriesNode` with nested
    //     file node as children.
    const data = this.buildFileTree(TREE_DATA, 0);

    // Notify the change.
    this.dataChange.next(data);
  }

  /**
   * Build the file structure tree. The `value` is the Json object, or a sub-tree of a Json object.
   * The return value is the list of `CountriesNode`.
   */
  buildFileTree(value: any, level: number) {
    let data: any[] = [];
    for (let k in value) {
      let v = value[k];
      let node = new CountriesNode();
      node.place = `${k}`;
      if (v === null || v === undefined) {
        // no action
      } else if (typeof v === 'object') {
        node.children = this.buildFileTree(v, level + 1);
      } else {
        node.place = v;
      }
      data.push(node);
    }
    return data;
  }

  /** Add an place to Country list */
  insertPlace(parent: CountriesNode, name: string) {
    const child = <CountriesNode>{ place: name };
    if (parent.children) { // parent already has children
      parent.children.push(child);
      this.dataChange.next(this.data);
    }
    else { // if parent is a leaf node
      parent.children = [];
      parent.children.push(child);
      this.dataChange.next(this.data);
    }
  }

  updatePlace(node: CountriesNode, name: string) {
    node.place = name;
    this.dataChange.next(this.data);
  }
}

/**
 * @title Tree with checkboxes
 */








@Component({
  selector: 'app-country',
  templateUrl: './country.component.html',
  styleUrls: ['./country.component.scss'],
  providers: [ChecklistDatabase]
})
export class LeftMenuComponent {
  /** Map from flat node to nested node. This helps us finding the nested node to be modified */
  flatNodeMap: Map<CountriesFlatNode, CountriesNode> = new Map<CountriesFlatNode, CountriesNode>();

  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  nestedNodeMap: Map<CountriesNode, CountriesFlatNode> = new Map<CountriesNode, CountriesFlatNode>();

  /** A selected parent node to be inserted */
  selectedParent: CountriesFlatNode | null = null;

  /** The new node's name */
  newPlaceName: string = '';

  treeControl: FlatTreeControl<CountriesFlatNode>;

  treeFlattener: MatTreeFlattener<CountriesNode, CountriesFlatNode>;

  dataSource: MatTreeFlatDataSource<CountriesNode, CountriesFlatNode>;

  /** The selection for checklist */
  checklistSelection = new SelectionModel<CountriesFlatNode>(true /* multiple */);

  constructor(private database: ChecklistDatabase) {
    this.treeFlattener = new MatTreeFlattener(this.transformer, this.getLevel,
      this.isExpandable, this.getChildren);
    this.treeControl = new FlatTreeControl<CountriesFlatNode>(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

    database.dataChange.subscribe(data => {
      this.dataSource.data = data;
    });
  }

  getLevel = (node: CountriesFlatNode) => node.level;

  isExpandable = (node: CountriesFlatNode) => node.expandable;

  getChildren = (node: CountriesNode): Observable<CountriesNode[]> => {
    return ofObservable(node.children);
  }

  hasChild = (_: number, _nodeData: CountriesFlatNode) => { return _nodeData.expandable; };

  hasNoContent = (_: number, _nodeData: CountriesFlatNode) => { return _nodeData.place === ''; };

  /**
   * Transformer to convert nested node to flat node. Record the nodes in maps for later use.
   */
  transformer = (node: CountriesNode, level: number) => {
    let flatNode = this.nestedNodeMap.has(node) && this.nestedNodeMap.get(node)!.place === node.place
      ? this.nestedNodeMap.get(node)!
      : new CountriesFlatNode();
    flatNode.place = node.place;
    flatNode.level = level;
    flatNode.expandable = !!node.children;
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  }

  /** Whether all the descendants of the node are selected */
  descendantsAllSelected(node: CountriesFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    return descendants.every(child => this.checklistSelection.isSelected(child));
  }

  /** Whether part of the descendants are selected */
  descendantsPartiallySelected(node: CountriesFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some(child => this.checklistSelection.isSelected(child));
    return result && !this.descendantsAllSelected(node);
  }

  /** Toggle the Country selection. Select/deselect all the descendants node */
  CountriesSelectionToggle(node: CountriesFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    this.checklistSelection.isSelected(node)
      ? this.checklistSelection.select(...descendants)
      : this.checklistSelection.deselect(...descendants);
  }

  /** Select the category so we can insert the new node. */
  addNewPlace(node: CountriesFlatNode) {
    const parentNode = this.flatNodeMap.get(node);
   
    let isParentHasChildren: boolean = false;
    if (parentNode.children)
      isParentHasChildren = true;
    
    this.database.insertPlace(parentNode!, '');
    // expand the subtree only if the parent has children (parent is not a leaf node)
    if (isParentHasChildren)
      this.treeControl.expand(node);
  }

  /** Save the node to database */
  saveNode(node: CountriesFlatNode, nodeValue: string) {
    const nestedNode = this.flatNodeMap.get(node);
    // tslint:disable-next-line:no-non-null-assertion
    this.database.updatePlace(nestedNode!, nodeValue);
  }
}

