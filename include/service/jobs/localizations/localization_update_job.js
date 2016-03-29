
//dependencies
var async = require('async');
var util  = require('../../../util.js');

module.exports = function LocalizationUpdateJobModule(pb) {

    /**
     * Job to pull the locales from the db and insert them in memory.
     * @class LocalizationUpdateJob
     * @constructor
     * @extends SiteJobRunner
     */
    function LocalizationUpdateJob(){
        LocalizationUpdateJob.super_.call(this);

        //initialize
        this.init();
        this.setParallelLimit(1);
    }
    util.inherits(LocalizationUpdateJob, pb.LocalizationJobRunner);

    /**
     * Get tasks to update Localization storage across clusters.
     * @method getInitiatorTasks
     * @override
     * @param {Function} cb - callback function
     */
    LocalizationUpdateJob.prototype.getInitiatorTasks = function(cb) {
        var self = this;
        //progress function
        var jobId = self.getId();
        var site = self.getSite();

        var activateCommand = {
            jobId: jobId,
            site: site
        };

        var tasks = [
            //activate site in mongo
            function(callback) {
                self.doPersistenceTasks(function(err, results) {
                    self.onUpdate(100 / tasks.length);
                    if (util.isError(err)) {
                        self.log(err.stack);
                    }
                    callback(err, results);
                });
            },

            //add site to request handler site collection across cluster
            self.createCommandTask('update_localizations', activateCommand)
        ];
        cb(null, tasks);
    };

    /**
     * Get tasks to activate user facing, non-admin routes for the site.
     * @method getWorkerTasks
     * @override
     * @param {Function} cb - callback function
     */
    LocalizationUpdateJob.prototype.getWorkerTasks = function(cb) {
        var site = this.getSite();
        var tasks = [
            //update localization storage
            function(callback) {
                var opts = {
                    where: {_id: site}
                };
                var queryService = new pb.SiteQueryService({site: site, onlyThisSite: true});
                queryService.q("localizations", opts, function (err, result) {
                    if (util.isError(err)) {
                        pb.log.error(err);
                        return callback(err);
                    }
                    if (result && result[0] && result[0].storage) {
                        pb.Localization.storage[site] = result[0].storage[site];
                    } else {
                        pb.Localization.storage[site] = {};
                    }
                    callback(null, true);
                });
            }
        ];
        cb(null, tasks);
    };

    /**
     * Set sites active in the database and activate the site in the RequestHandler.
     * @method doPersistenceTasks
     * @param {Function} cb - callback function
     */
    LocalizationUpdateJob.prototype.doPersistenceTasks = function(cb) {
        var site   = this.getSite();
        var tasks     = [
            //update localization storage
            function(callback) {
                var opts = {
                    where: {_id: site}
                };
                var queryService = new pb.SiteQueryService({site: site, onlyThisSite: true});
                queryService.q("localizations", opts, function (err, result) {
                    if (util.isError(err)) {
                        pb.log.error(err);
                        return callback(err);
                    }
                    if (result && result[0] && result[0].storage) {
                        pb.Localization.storage[site] = result[0].storage[site];
                    } else {
                        pb.Localization.storage[site] = {};
                    }
                    callback(null, true);
                });
            }
        ];
        async.series(tasks, function(err/*, results*/) {
            cb(err, !util.isError(err));
        });
    };

    //exports
    return LocalizationUpdateJob;
};