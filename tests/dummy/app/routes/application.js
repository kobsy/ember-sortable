import Ember from 'ember';
const a = Ember.A;

export default Ember.Route.extend({
  model() {
    return {
      items: a(['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco']),
      alsoItems: a(['One', 'Two', 'Three', 'Four', 'Five'])
    };
  },

  actions: {
    update(newOrder, draggedModel) {
      this.set('currentModel.items', a(newOrder));
      this.set('currentModel.dragged', draggedModel);
    },
    nestedUpdate(listName, newOrder, draggedModel, sourceListName) {
      Ember.Logger.debug(newOrder);
      this.set(`currentModel.${listName}`, a(newOrder));
      if(sourceListName !== undefined && listName !== sourceListName) {
        this.get(`currentModel.${sourceListName}`).removeObject(draggedModel);
      }

      this.set('currentModel.dragged', draggedModel);
    }
  }
});
