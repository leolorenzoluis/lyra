vde.App.factory('draggable', function($rootScope, Vis, iVis) {
  return {
    dragstart: function(e, dd, proxy) {
      var isMark = proxy.hasClass('mark'),
          v = iVis.activeMark;

      if(isMark) {
        var markType = proxy.attr('id');
        iVis.newMark = eval('new Vis.marks["' + markType + '"]');
      } else {
//        $(dd.available).each(function(i, a) {
//          // Only light up properties without nodrop
//          if(!$(a).hasClass('property')) return;
//          if($(a).parent().attr('nodrop')) return;
//
//          $(a).addClass('available');
//        });
        $('.canDropField').addClass('dragging');
      }

      if(v instanceof Vis.Mark) {
        if(isMark && iVis.newMark.canConnect) v.connectionTargets();
        else if(!isMark)  {
          // Definitely show any property targets for the active visual
          v.propertyTargets(null, !$rootScope.activePipeline.forkName);
        }
      } else if(!isMark && !v) {
        // If the pipeline doesn't already have a facet applied to it
        // show dropzones for grouping
        if(!$rootScope.activePipeline.forkName) {
          var targets = $rootScope.activeLayer.propertyTargets();
          iVis.interactor('span', targets.spans)
            .interactor('dropzone', targets.dropzones)
            .show(['span', 'dropzone']);
        }
      }

      return proxy;
    },

    drag: function(e, dd) {
      iVis.dragging = dd.proxy;
      $(dd.proxy).css({
        top: e.pageY + 5,
        left: e.pageX - $(dd.proxy).width()
      });
    },

    dragend: function(e, dd) {
      iVis.dragging = null;
      iVis.newMark  = null;
      iVis.show('selected');
//      $(dd.available).removeClass('available');
      $(dd.proxy).unbind().empty().remove();
      dd.proxy = null;
      $('.canDropField').removeClass('dragging');
      $('.tooltip').remove();
    }
  }
});

vde.App.directive('vdeDraggable', function($rootScope, draggable) {
  return function(scope, element, attrs) {
    element
      .drag('start', function(e, dd) {
        var proxy = $(this).clone(true, true)
            .addClass('proxy')
            .css('opacity', 0.75)
            .css('position', 'absolute')
            .css('z-index', 100)
            .appendTo(document.body);

        return draggable.dragstart(e, dd, proxy);
      })
      .drag(draggable.drag)
      .drag('end', draggable.dragend);
  }
});
