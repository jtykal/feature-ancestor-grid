Ext.define("feature-ancestor-grid", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    integrationHeaders : {
        name : "feature-ancestor-grid"
    },

    config: {
        defaultSettings: {
            query: ''
        }
    },

    launch: function() {
        // this.logger.log('LAUNCH APPLICATION');
        this.fetchPortfolioItemTypes().then({
            success: this.initializeApp,
            failure: this.showErrorNotification,
            scope: this
        });

    },

    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({
            message: msg
        });
    },

    initializeApp: function(portfolioTypes){
        this.portfolioItemTypeDefs = Ext.Array.map(portfolioTypes, function(p){ return p.getData();});
        this.portfolioItemTypeDefs.shift();  // remove the first level portfolio item type from the list
        // this.logger.log('initalizeApp(), portfolioItemTypeDefs= ', this.portfolioItemTypeDefs);
        this._buildGridboardStore();
        // this.logger.log('END initializeApp(): this.piAncestorHash= ', this.piAncestorHash);
    },

    getpiName: function(){
        return this.getPITypePath().replace('PortfolioItem/','');
    },

    getPITypePath: function(){
        return this.portfolioItemTypeDefs[0].TypePath;
    },

    getPortfolioItemTypePaths: function(){
        return _.pluck(this.portfolioItemTypeDefs, 'TypePath');
    },

    fetchPortfolioItemTypes: function(){
        return this.fetchWsapiRecords({
            model: 'TypeDefinition',
            fetch: ['TypePath', 'Ordinal','Name'],
            context: {workspace: this.getContext().getWorkspace()._ref},
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ],
            sorters: [{
                property: 'Ordinal',
                direction: 'ASC'
            }]
        });
    },

    fetchSnapshots: function(config){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.lookback.SnapshotStore', config).load({
            callback: function(snapshots, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve(snapshots);
                } else {
                    deferred.reject('Failed to load snapshots: ', operation && operation.error && operation.error.errors.join(','))
                }
            }
        });

        return deferred;
    },

    getQueryFilter: function(){
        var query = this.getSetting('query');
        if (query && query.length > 0){
            // this.logger.log('getQueryFilter', Rally.data.wsapi.Filter.fromQueryString(query));
            return Rally.data.wsapi.Filter.fromQueryString(query);
        }
        return [];
    },

    _buildGridboardStore: function(){
        // this.logger.log('START _buildGridboardStore');
        this.removeAll();

        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: this.getModelNames(),
            // autoLoad: true,
            enableHierarchy: true,
            //fetch: [this.getpiName(),'ObjectID'],
            fetch: ['Parent','ObjectID'],
            filters: this.getQueryFilter()
        }).then({
            success: this._addGridboard,
            failure: this.showErrorNotification,
            scope: this
        });
    },

    getModelNames: function(){
        return ['portfolioitem/feature'];  // **** HARD CODED ****
    },

getpiAncestorHash: function(){
    // this.logger.log('START getpiAncestorHash(): ', this.piAncestorHash);  // value is "undefined"
        if (!this.piAncestorHash){
            this.piAncestorHash = {};
        }
        // this.logger.log('getpiAncestorHash() returns: ', this.piAncestorHash);  // RETURNS EMPTY - SHOULD BE LIST OF INITIATIVES
        return this.piAncestorHash;
    },

    setAncestors: function(records){
    // this.logger.log('START setAncestors()');
        var piHash = this.getpiAncestorHash();
            // piName = this.getpiName();

        // this.logger.log('setAncestors(): records= ', records, 'piHash = ',piHash);

        for (var j=0; j<records.length; j++){
            var record = records[j],
                pi = record.get('Parent');

            // this.logger.log('setAncestors() loop1: j=', j, 'record = ', record, 'parent = ', pi);
            // GETTING A GOOD RECORD (feature) and PARENT (initiative) at this point...

            if (pi){
                var objID = pi.ObjectID;
                var piObj = piHash[objID];
                // this.logger.log('setAncestors() line 150: objID =', objID, ' piObj =', piObj);

                var name = this.portfolioItemTypeDefs[0].TypePath.toLowerCase().replace('portfolioitem/','');
                record.set(name, pi);
                // this.logger.log('setAncestors() line 153 RECORD SET: name = ', name, 'pi= ', pi);

                for (var i=1; i<this.portfolioItemTypeDefs.length; i++){
                    name = this.portfolioItemTypeDefs[i].TypePath.toLowerCase().replace('portfolioitem/','');
                    // this.logger.log('setAncestors() line 154: i=', i, 'name = ', name, 'piObj= ', piObj, 'piObj[name]=', piObj[name]);
                    if (piObj && piObj[name]){
                        record.set(name, piObj[name]);
                        // this.logger.log('setAncestors() line 160 RECORD SET: name = ', name, 'piObj[name] = ', piObj[name]);
                    } else {
                        record.set(name, null);
                    }
                }
            }
        }
    },

    updateHashWithWsapiRecords: function(results){
        // this.logger.log('START updateHashWithWsapiRecords()', results);
        var hash = {},
            pis = [],
            piTypePath = this.getPortfolioItemTypePaths()[0].toLowerCase(),
            ancestorNames = _.map(this.getPortfolioItemTypePaths(), function(pi){
               return pi.toLowerCase().replace('portfolioitem/','');
            });
        // ancestorNames = ['initiative', 'theme'];

        // this.logger.log('updateHashWithWsapiRecords(); piTypePath= ',piTypePath,'ancestorNames= ',ancestorNames);

        Ext.Array.each(results, function(res){
            Ext.Array.each(res, function(pi){
                hash[pi.get('ObjectID')] = pi.getData();
                if (pi.get('_type') === piTypePath){
                    pis.push(pi);
                }
            });
        });

        // this.logger.log('updateHashWithWsapiRecords(); results= ', results);

        var piHash = this.getpiAncestorHash();
        Ext.Array.each(pis, function(s){

            var parent = s.get('Parent') && s.get('Parent').ObjectID || null,
                objID = s.get('ObjectID');

            if (!piHash[objID]){
                piHash[objID] = hash[objID];
                //initialize
                Ext.Array.each(ancestorNames, function(a){ piHash[objID][a] = null; });
            }

            if (parent && piHash[objID]){
                do {
                    var parentObj = hash[parent] || null,
                        parentName = hash[parent] && hash[parent]._type.replace('portfolioitem/','');

                    if (piHash[objID]){
                        piHash[objID][parentName] = parentObj;
                        parent = parentObj && parentObj.Parent && parentObj.Parent.ObjectID || null;
                    }
                } while (parent !== null);
            }
        });

    },

    fetchAncestors: function(piOids){
    // this.logger.log('START fetchAncestors()');
        var deferred = Ext.create('Deft.Deferred');

        var promises = [];
        for (var i = 0; i< this.getPortfolioItemTypePaths().length; i++){
            var type = this.getPortfolioItemTypePaths()[i];

            var filterProperties = ['ObjectID'];

            for (var j=0; j<i; j++){
                // this.logger.log('line 228- inside j loop');
                filterProperties.unshift('Children');
            }

            var filterProperty = filterProperties.join('.');

            var filters = _.map(piOids, function(f){
                return {
                    property: filterProperty,
                    value: f
                }
            });
            filters = Rally.data.wsapi.Filter.or(filters);
            // this.logger.log('type', type, filters.toString());

            promises.push(this.fetchWsapiRecords({
                model: type,
                fetch: ['FormattedID','Name','Parent','ObjectID'],
                enablePostGet: true,
                limit: Infinity,
                pageSize: 1000,
                context: {project: null},
                filters: filters
            }));
        }
        this.setLoading('Loading Ancestor data...');
        Deft.Promise.all(promises).then({
            success: function(results){
                deferred.resolve(results);
            },
            failure: this.showErrorNotification,
            scope: this
        }).always(function(){ this.setLoading(false);},this);
        return deferred;


    },

    updateFeatures: function(store, node, records, operation){
        // this.logger.log('START updateFeatures(): this.piAncestorHash= ',this.piAncestorHash);
        // this.logger.log('START updateFeatures(): ',records, operation);

        if (records.length === 0 || records[0].get('_type') !== 'portfolioitem/feature'){  // **** HARD CODED ****
                return;
        }

        // var piName = this.getpiName(),
        var piName = 'Parent',  // portfolio item "Parent" field
            piHash = this.getpiAncestorHash(),  // SHOULD BE LIST OF INITIATIVES
            piOids = [];
            // this.logger.log('updateFeatures(): piName= ', piName, ', piHash= ', piHash);

        Ext.Array.each(records, function(r){
            var pi = r.get(piName);
            // this.logger.log('updateFeatures() loop: pi= ', pi);

            if (pi && !piHash[pi.ObjectID]){
                // this.logger.log('updateFeatures() inside if1: pi= ', pi.FormattedID);
                if (!Ext.Array.contains(piOids,pi.ObjectID)){
                    // this.logger.log('updateFeatures() inside if2: pi= ', pi.FormattedID);
                    piOids.push(pi.ObjectID);
                }
            }
        }, this);
        // this.logger.log('updateFeatures(): piOids', piOids);

        if (piOids.length > 0){
            this.fetchAncestors(piOids).then({
                success: function(results){
                    this.updateHashWithWsapiRecords(results);
                    this.setAncestors(records);
                },
                failure: this.showErrorNotification,
                scope: this
            });
        } else {
            // this.logger.log('updateFeatures() calling this.setAncestors with records=', records);
            this.setAncestors(records)
        }
    },

    _addGridboard: function(store) {
    // this.logger.log('START _addGridboard(), store=', store);
        for (var i=0; i<this.portfolioItemTypeDefs.length; i++){
            var name =  this.portfolioItemTypeDefs[i].Name.toLowerCase();
            // this.logger.log('_addGridboard(): ', i, name);
            store.model.addField({name: name, type: 'auto', defaultValue: null});
        }
        store.on('load', this.updateFeatures, this);

        this.add({
            xtype: 'rallygridboard',
            context: this.getContext(),
            modelNames: this.getModelNames(),
            toggleState: 'grid',
            plugins: this.getGridPlugins(),
            stateful: false,
            gridConfig: {
                store: store,
                storeConfig: {
                    filters: this.getQueryFilter()
                },
                columnCfgs: this.getColumnConfigs(),
                derivedColumns: this.getDerivedColumns()
            },
            height: this.getHeight()
        });
    },

    getGridPlugins: function(){
    // this.logger.log('START getGridPlugins()');
        return [{
            ptype:'rallygridboardaddnew'
        },
            {
                ptype: 'rallygridboardfieldpicker',
                headerPosition: 'left',
                modelNames: this.getModelNames(),
                alwaysSelectedValues: [this.getpiName()],
                stateful: true,
                margin: '3 3 3 25',
                stateId: this.getContext().getScopedStateId('ancestor-columns-1')
            },{
                ptype: 'rallygridboardinlinefiltercontrol',
                inlineFilterButtonConfig: {
                    stateful: true,
                    stateId: this.getContext().getScopedStateId('ancestor-filters'),
                    modelNames: this.getModelNames(),
                    margin: 3,
                    inlineFilterPanelConfig: {
                        quickFilterPanelConfig: {
                            defaultFields: [
                                'ArtifactSearch',
                                'Owner',
                                'ModelType'
                            ]
                        },
                        advancedFilterPanelConfig: {
                            advancedFilterRowsConfig: {
                                flex: 2
                            }
                        }

                    }
                }
            }, {
                ptype: 'rallygridboardactionsmenu',
                menuItems: [
                    {
                        text: 'Export...',
                        handler: this._export,
                        scope: this
                    }
                    /*,{
                        text: 'Export Stories and Tasks...',
                        handler: this._deepExport,
                        scope: this
                    } */
                ],
                buttonConfig: {
                    margin: 3,
                    iconCls: 'icon-export'
                }
            }];
    },

    getExportFilters: function(){
//        this.logger.log('START getExportFilters()');
        var filters = this.getQueryFilter(),
            gridFilters = this.down('rallygridboard').currentCustomFilter.filters || [];

        if (filters.length > 0 && gridFilters.length > 0){
            filters = filters.and(gridFilters);
        } else {
            if (gridFilters.length > 0){
               filters = gridFilters;
            }
        }
//        this.logger.log('getExportFilters()', filters.toString());
        return filters;
    },

    updateExportFeatures: function(records){
        var deferred = Ext.create('Deft.Deferred');

//        this.logger.log('START updateExportFeatures(): records = ',records);

        if (records.length === 0 || records[0].get('_type') !== 'portfolioitem/feature'){  // **** HARD CODED ****
            deferred.resolve([]);
        }
        // var piName = this.getpiName(),
        var piName = 'Parent',  // portfolio item "Parent" field
            piHash = this.getpiAncestorHash(),
            piOids = [];

//        this.logger.log('line 425: piHash = ', piHash);
        Ext.Array.each(records, function(r){
            var pi = r.get(piName);
//            this.logger.log('line 428: inside loop, pi = ',pi, 'piHash[pi.ObjectID] = ', piHash[pi.ObjectID]);
            if (pi && !piHash[pi.ObjectID]){
                if (!Ext.Array.contains(piOids,pi.ObjectID)){
                    piOids.push(pi.ObjectID);
                }

            }
        }, this);
//        this.logger.log('updateExportFeatures(): piOids = ', piOids);

        if (piOids.length > 0) {
            this.fetchAncestors(piOids).then({
                success: function (results) {
                    this.updateHashWithWsapiRecords(results);
                    this.setAncestors(records);
                    deferred.resolve(records);
                },
                failure: function (msg) {
                    deferred.reject(msg);
                },
                scope: this
            });
        }else {
            this.setAncestors(records);
            deferred.resolve(records);
        }

        return deferred;
    },

/*
    _deepExport: function(){
        this._export(true);
    },
*/

// _export: function(includeTasks) {
    _export: function() {
//        this.logger.log('START _export()');

        var filters = this.getExportFilters();

        var columnCfgs = this.down('rallytreegrid').columns,
            additionalFields = _.filter(columnCfgs, function(c){ return c.text !== 'Rank' && (c.xtype === 'rallyfieldcolumn' || c.xtype === "treecolumn"); }),
            derivedFields = this.getDerivedColumns(),
            columns = Ext.Array.merge(additionalFields, derivedFields);

        var fetch = _.pluck(additionalFields, 'dataIndex');
        fetch.push('ObjectID');

/*        if (includeTasks){
            fetch.push('Tasks');
        } */

        // if (!Ext.Array.contains(fetch, this.getpiName())){
        //     fetch.push(this.getpiName());
        if (!Ext.Array.contains(fetch, 'Parent')){
            fetch.push('Parent');
        }
        this.setLoading('Loading data to export...');
        // this.logger.log('columns', columnCfgs);
        this.fetchWsapiRecords({
            model: 'Portfolio Item/Feature',
            fetch: fetch,
            filters: filters,
            limit: 'Infinity'
        }).then({
            success: this.updateExportFeatures,
            scope: this
        }).then({
            success: function(records){
/*                if (includeTasks){
                    this._exportTasks(records, fetch, columns);
                } else { */
                    var csv = this.getExportCSV(records, columns);
                    var filename = Ext.String.format("export-{0}.csv",Ext.Date.format(new Date(),"Y-m-d-h-i-s"));
                    CArABU.technicalservices.FileUtilities.saveCSVToFile(csv, filename);
                // }
            },
            failure: this.showErrorNotification,
            scope: this
        }).always(function(){ this.setLoading(false); }, this);
    },

/*
    _exportTasks: function(userStories, fetch, columns){

        var oids = [];
        for (var i=0; i<userStories.length; i++){
            if (userStories[i].get('Tasks') && userStories[i].get('Tasks').Count){
                oids.push(userStories[i].get('ObjectID'));
            }
        }
        var filters = Ext.Array.map(oids, function(o){
            return {
                property: 'WorkProduct.ObjectID',
                value: o
            };
        });
        filters = Rally.data.wsapi.Filter.or(filters);

        fetch.push('WorkProduct');
        this.fetchWsapiRecords({
            model: 'Task',
            fetch: fetch,
            filters: filters,
            limit: 'Infinity',
            enablePostGet: true
        }).then({
            success: function(tasks){
                // this.logger.log('exportTasks', tasks.length);
                var taskHash = {};
                for (var j=0; j<tasks.length; j++){
                    if (!taskHash[tasks[j].get('WorkProduct').ObjectID]){
                        taskHash[tasks[j].get('WorkProduct').ObjectID] = [];
                    }
                    taskHash[tasks[j].get('WorkProduct').ObjectID].push(tasks[j]);
                }

                var rows = [];
                for (var j=0; j<userStories.length; j++){
                    rows.push(userStories[j]);
                    var ts = taskHash[userStories[j].get('ObjectID')];
                    if (ts && ts.length > 0){
                        rows = rows.concat(ts);
                    }
                }

                columns.push({
                    dataIndex: 'WorkProduct',
                    text: 'User Story'
                });
                var csv = this.getExportCSV(rows, columns);
                var filename = Ext.String.format("export-{0}.csv",Ext.Date.format(new Date(),"Y-m-d-h-i-s"));
                CArABU.technicalservices.FileUtilities.saveCSVToFile(csv, filename);
            },
            failure: function(msg){
                var msg = "Unable to export tasks due to error:  " + msg
                this.showErrorNotification(msg);
            },
            scope: this
        });
    },
*/

    getExportCSV: function(records, columns){
        var standardColumns = _.filter(columns, function(c){ return c.dataIndex || null; }),
            headers = _.map(standardColumns, function(c){ if (c.text === "ID") {return "Formatted ID"; } return c.text; }),
            fetchList = _.map(standardColumns, function(c){ return c.dataIndex; }),
            derivedColumns = this.getDerivedColumns();

//        this.logger.log('getExportCSV()', headers, fetchList);

        Ext.Array.each(derivedColumns, function(d){
            headers.push(d.text);
        });

        var csv = [headers.join(',')];

        for (var i = 0; i < records.length; i++){
            var row = [],
                record = records[i];

            for (var j = 0; j < fetchList.length; j++){
                var val = record.get(fetchList[j]);
                if (Ext.isObject(val)){
                    val = val.FormattedID || val._refObjectName;
                }
                row.push(val || "");
            }

            Ext.Array.each(derivedColumns, function(d){
                var ancestor = record.get(d.ancestorName);
                if (ancestor){
                    row.push(Ext.String.format("{0}: {1}", ancestor.FormattedID, ancestor.Name));
                } else {
                    row.push("");
                }
            });

            row = _.map(row, function(v){ return Ext.String.format("\"{0}\"", v.toString().replace(/"/g, "\"\""));});
            csv.push(row.join(","));
        }
        return csv.join("\r\n");
    },

    getColumnConfigs: function(){
        var cols = [{
            dataIndex: 'Name',
            text: 'Name'
        },{
            dataIndex: 'State',
            text: 'State'
        },{
            dataIndex: 'Release',
            text: 'Release'
        },{
            dataIndex: this.getpiName(),
            text: this.getpiName()
        }].concat(this.getDerivedColumns());
        // this.logger.log('cols', cols);
        return cols;
    },

    getDerivedColumns: function(){
        var cols = [];
        //Ext.Array.each(this.portfolioItemTypeDefs, function(p){
        for (var i = 0; i< this.portfolioItemTypeDefs.length; i++){

            var name = this.portfolioItemTypeDefs[i].TypePath.toLowerCase().replace('portfolioitem/','');

            cols.push({
               // dataIndex: name,
                ancestorName: name,
                xtype: 'ancestortemplatecolumn',
                text: this.portfolioItemTypeDefs[i].Name
            });
        }

        return cols;
    },

    fetchWsapiRecords: function(config){
    // this.logger.log('START fetchWsapiRecords()');
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store',config).load({
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve(records);
                } else {
                    deferred.reject(Ext.String.format('Failed to fetch {0} records: {1}',config.model ,operation && operation.error && operation.error.errors.join(',')));
                }
            }
        });
        return deferred;
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },

    getSettingsFields: function(){
        return [{
            xtype: 'textarea',
            fieldLabel: 'Query Filter',
            name: 'query',
            anchor: '100%',
            cls: 'query-field',
            margin: '0 70 0 0',
            labelAlign: 'right',
            labelWidth: 100,
            plugins: [
                {
                    ptype: 'rallyhelpfield',
                    helpId: 194
                },
                'rallyfieldvalidationui'
            ],
            validateOnBlur: false,
            validateOnChange: false,
            validator: function(value) {
                try {
                    if (value) {
                        Rally.data.wsapi.Filter.fromQueryString(value);
                    }
                    return true;
                } catch (e) {
                    return e.message;
                }
            }
        }];
    },

    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        // this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this._buildGridboardStore();
    }
});
