import Ember from 'ember';
import layout from '../templates/components/sortable-group';
import computed from 'ember-new-computed';
const { A, Component, get, set, run } = Ember;
const a = A;
const NO_MODEL = {};

export default Component.extend({
  layout: layout,

  /**
    @property direction
    @type string
    @default y
  */
  direction: 'y',

  /**
    @property model
    @type Any
    @default null
  */
  model: NO_MODEL,

  /**
    @property group
    @type SortableGroup
    @default null
  */
  group: null,

  /**
    @property items
    @type Ember.NativeArray
  */
  items: computed(() => a()),

  /**
    @property subgroups
    @type Ember.NativeArray
  */
  subgroups: computed(() => a()),

  /**
    @property siblings
    @type Ember.NativeArray
  */
  siblings: computed('group.subgroups', function() {
    if(this.get('group.subgroups')) {
      return this.get('group.subgroups').without(this).filter(subgroup => subgroup.get('direction') === this.get('direction'));
    } else {
      return a();
    }
  }),

  /**
    Position for the first item.
    If spacing is present, first item's position will have to change as well.
    @property itemPosition
    @type Number
  */
  itemPosition: computed(function() {
    let direction = this.get('direction');

    return this.get(`sortedItems.firstObject.${direction}`) - this.get('sortedItems.firstObject.spacing');
  }).volatile(),

  /**
    Position for the bottom of the last item.
    If spacing is present, the last item's position will have to change as well?
    @property bottomPosition
    @type Number
  */
  bottomPosition: computed(function() {
    let direction = this.get('direction');
    let dimension = direction === 'y' ? 'height' : 'width';

    return this.get(`sortedItems.lastObject.${direction}`) + this.get('sortedItems.lastObject.spacing') + this.get(`sortedItems.lastObject.${dimension}`);
  }).volatile(),

  /**
    @property sortedItems
    @type Array
  */
  sortedItems: computed(function() {
    let items = a(this.get('items'));
    let direction = this.get('direction');

    return items.sortBy(direction);
  }).volatile(),

  /**
    @method didInsertElement
  */
  didInsertElement() {
    this._super();
    // scheduled to prevent deprecation warning:
    // "never change properties on components, services or models during didInsertElement because it causes significant performance degradation"
    if(this.get('group')) {
      run.schedule("afterRender", this, "_tellGroup", "registerSubgroup", this);
    }
  },

  /**
    @method willDestroyElement
  */
  willDestroyElement() {
    // scheduled to prevent deprecation warning:
    // "never change properties on components, services or models during didInsertElement because it causes significant performance degradation"
    run.schedule("afterRender", this, "_tellGroup", "deregisterSubgroup", this);
  },

  /**
    Register an item with this group.
    @method registerItem
    @param {SortableItem} [item]
  */
  registerItem(item) {
    this.get('items').addObject(item);
  },

  /**
    De-register an item with this group.
    @method deregisterItem
    @param {SortableItem} [item]
  */
  deregisterItem(item) {
    this.get('items').removeObject(item);
  },

  /**
    Register a subgroup with this group.
    @method registerSubgroup
    @param {SortableGroup} [subgroup]
  */
  registerSubgroup(subgroup) {
    this.get('subgroups').addObject(subgroup);
  },

  /**
    De-register a subgroup with this group.
    @method deregisterSubgroup
    @param {SortableGroup} [subgroup]
  */
  deregisterSubgroup(subgroup) {
    this.get('subgroups').removeObject(subgroup);
  },

  /**
    Prepare for sorting.
    Main purpose is to stash the current itemPosition so
    we don’t incur expensive re-layouts.
    @method prepare
  */
  prepare() {
    this._itemPosition = this.get('itemPosition');
    this._bottomPosition = this.get('bottomPosition');
  },

  /**
    Update item positions (relatively to the first element position).
    @method update
  */
  update() {
    let sortedItems = this.get('sortedItems');
    // Position of the first element
    let position = this._itemPosition;
    let maxPosition = this._bottomPosition;

    // Just in case we haven’t called prepare first.
    if (position === undefined) {
      position = this.get('itemPosition');
    }
    let minPosition = position;
    if (maxPosition === undefined) {
      maxPosition = this.get('bottomPosition');
    }

    // TODO: check if items have positions within the ranges of sibling subgroups
    // If so, register them to the new group and de-register them from the old one (this one)
    // We'll leave the `group` property on the item in-tact, however, so we can tell whence it came.


    sortedItems.forEach(item => {
      let dimension;
      let direction = this.get('direction');

      if (get(item, direction) < minPosition || get(item, direction) > maxPosition) {
        Ember.Logger.debug('[sortable-group] update(): item\'s position is outside group bounds!');
        this.get('siblings').forEach(sibling => {
          if(get(item, direction) > get(sibling, 'itemPosition') && get(item, direction) < get(sibling, 'bottomPosition')) {
            sibling.registerItem(item);
            this.deregisterItem(item);
            set(item, 'sourceGroup', this);
            set(item, 'group', sibling);
            this.prepare();
            return this.update();
          }
        })
      }

      if (!get(item, 'isDragging')) {
        set(item, direction, position);
      }

      // add additional spacing around active element
      if (get(item, 'isBusy')) {
        position += get(item, 'spacing') * 2;
      }

      if (direction === 'x') {
        dimension = 'width';
      }
      if (direction === 'y') {
        dimension = 'height';
      }

      position += get(item, dimension);
    });
  },

  /**
    @method commit
  */
  commit() {
    let items = this.get('sortedItems');
    let groupModel = this.get('model');
    let itemModels = items.mapBy('model');
    let draggedItem = items.findBy('wasDropped', true);
    let draggedModel, sourceGroupModel;

    if (draggedItem) {
      set(draggedItem, 'wasDropped', false); // Reset
      draggedModel = get(draggedItem, 'model');
      sourceGroupModel = get(draggedItem, 'sourceGroup.model');
    }

    delete this._itemPosition;

    run.schedule('render', () => {
      items.invoke('freeze');
    });

    run.schedule('afterRender', () => {
      items.invoke('reset');
    });

    run.next(() => {
      run.schedule('render', () => {
        items.invoke('thaw');
      });
    });

    if (groupModel !== NO_MODEL) {
      this.sendAction('onChange', groupModel, itemModels, draggedModel, sourceGroupModel);
    } else {
      this.sendAction('onChange', itemModels, draggedModel, sourceGroupModel);
    }
  },

  /**
    @method _tellGroup
    @private
  */
  _tellGroup(method, ...args) {
    let group = this.get('group');

    if (group) {
      group[method](...args);
    }
  }
});
