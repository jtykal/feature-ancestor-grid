Ext.override(Rally.ui.grid.TreeGrid, {
    _mergeColumnConfigs: function(newColumns, oldColumns) {

        var mergedColumns= _.map(newColumns, function(newColumn) {
            var oldColumn = _.find(oldColumns, {dataIndex: this._getColumnName(newColumn)});
            if (oldColumn) {
                return this._getColumnConfigFromColumn(oldColumn);
            }

            return newColumn;
        }, this);
        mergedColumns = mergedColumns.concat(this.config.derivedColumns);
        return mergedColumns;
    },
    _getColumnConfigsBasedOnCurrentOrder: function(columnConfigs) {
        return _(this.headerCt.items.getRange()).map(function(column) {
            //override:  Added additional search for column.text
            return _.contains(columnConfigs, column.dataIndex) ? column.dataIndex : _.find(columnConfigs, {dataIndex: column.dataIndex, text: column.text});
        }).compact().value();
    },
    _restoreColumnOrder: function(columnConfigs) {

        var currentColumns = this._getColumnConfigsBasedOnCurrentOrder(columnConfigs);
        var addedColumns = _.filter(columnConfigs, function(config) {
            return !_.find(currentColumns, {dataIndex: config.dataIndex}) || Ext.isString(config);
        });

        return currentColumns.concat(addedColumns);
    },
    _applyStatefulColumns: function(columns) {
        if (this.alwaysShowDefaultColumns) {
            _.each(this.columnCfgs, function(columnCfg) {
                if (!_.any(columns, {dataIndex: this._getColumnName(columnCfg)})) {
                    columns.push(columnCfg);
                }
            }, this);
        }
        if (this.config && this.config.derivedColumns){
            this.columnCfgs = columns.concat(this.config.derivedColumns);
        } else {
            this.columnCfgs = columns;
        }
    }
});

Ext.override(Rally.ui.inlinefilter.AdvancedFilterRows, {
    _getRowConfig: function() {
        console.log('OVERRIDE _getRowConfig()');
        return Ext.merge({
            xtype: 'rallyancestorfilterrow',
            autoExpand: this.autoExpand,
            model: this.model,
            context: this.context,
            focusPropertyField: false,
            operatorFieldConfig: this.operatorFieldConfig,
            propertyFieldConfig: this.propertyFieldConfig,
            listeners: {
                addrow: function() {
                    this._addRow(true);
                },
                removerow: this._removeRow,
                scope: this
            }
        }, this.rowConfig);
    }
});


/***************************************************************/
/* See https://github.com/RallyTechServices/utils-shared-views */
/***************************************************************/
Ext.override(Rally.ui.gridboard.SharedViewComboBox, {
    _isViewPreference: function(record) {
        console.log('OVERRIDE isViewPreference(): record= ',record);
        return record.self.typePath === 'preference' &&
            record.get('Type') === 'View' &&
            // This is fix. Must use '==' not '===' for this to return true
            record.get('AppId') == this.getContext().getAppId();
    },

    getSharedViewParam: function() {
        console.log('OVERRIDE getSharedViewParam()');
        var hash = parent.location.hash,
            matches = hash.match(/sharedViewId=(\d+)/);

        return matches && matches[1];
    },

    _ensureLatestView: function(state) {
        console.log('OVERRIDE _ensureLatestView(): state= ',state);
        if (state.objectId && state.versionId) {
            var modelLoadDeferred = Ext.create('Deft.Deferred');
            this.store.model.load(state.objectId, {
                fetch: ['VersionId', 'Value'],
                success: function(record) {
                    modelLoadDeferred.resolve(record);
                }
            });
            this.store.on('load', function() {
                modelLoadDeferred.promise.then({
                    success: function(record) {
                        if (record && record.get('VersionId') !== state.versionId) {
                            console.log('OVERRIDE line 103: record= ',record,' state= ',state);
                            this._applyView(this._decodeValue(record));
                        }
                    },
                    scope: this
                })
            }, this, { single: true });
        }
    },
})
/******************************************************************/