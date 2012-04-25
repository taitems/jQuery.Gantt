/**
*
* JQuery fn.gantt gantt chart plugin v1.2.0
* Copyright 2011 by Marek Bielańczuk
* http://mbielanczuk.com/
* Released under the MIT and GPL Licenses.
*
* Last Modified: Fri Feb 03 2012 8:57:00 +0800
*/

(function ($) {

    "use strict";

    $.fn.gantt = function (options) {

        var scales = ["hours", "days", "weeks", "months"];

        var settings = {
            source: null,
            itemsPerPage: 7,
            months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
            dow: ["S", "M", "T", "W", "T", "F", "S"],
            startPos: new Date(),
            navigate: "buttons",
            scale: "days",
            maxScale: "months",
            minScale: "hours",
            waitText: "Please wait..."
        };

        $.extend($.expr[":"], {
            findday: function (a, i, m) {
                var cd = new Date(parseInt(m[3]));
                var id = $(a).attr("id");
                id = id ? id : "";
                var si = id.indexOf("-") + 1;
                var ed = new Date(parseInt(id.substring(si, id.length)));
                cd = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate());
                ed = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
                return cd.getTime() === ed.getTime();
            }
        });

        $.extend($.expr[":"], {
            findweek: function (a, i, m) {
                var cd = new Date(parseInt(m[3]));
                var id = $(a).attr("id");
                id = id ? id : "";
                var si = id.indexOf("-") + 1;
                cd = cd.getFullYear() + "-" + cd.getDayForWeek().getWeekOfYear();
                var ed = id.substring(si, id.length);
                return cd === ed;
            }
        });

        $.extend($.expr[":"], {
            findmonth: function (a, i, m) {
                var cd = new Date(parseInt(m[3]));
                cd = cd.getFullYear() + "-" + cd.getMonth();
                var id = $(a).attr("id");
                id = id ? id : "";
                var si = id.indexOf("-") + 1;
                var ed = id.substring(si, id.length);
                return cd === ed;
            }
        });

        Date.prototype.getDayOfYear = function () {
            var fd = new Date(this.getFullYear(), 0, 0);
            var sd = new Date(this.getFullYear(), this.getMonth(), this.getDate());
            return Math.ceil((sd - fd) / 86400000);
        };
        Date.prototype.getWeekOfYear = function () {
            var ys = new Date(this.getFullYear(), 0, 1);
            var sd = new Date(this.getFullYear(), this.getMonth(), this.getDate());
            if (ys.getDay() > 3)
                ys = new Date(sd.getFullYear(), 0, 7 - ys.getDay());
            var daysCount = sd.getDayOfYear() - ys.getDayOfYear();
            return Math.ceil(daysCount / 7);
        };
        Date.prototype.getDaysInMonth = function () {
            return 32 - new Date(this.getFullYear(), this.getMonth(), 32).getDate();
        };
        Date.prototype.hasWeek = function () {
            var df = new Date(this.valueOf());
            df.setDate(df.getDate() - df.getDay());
            var dt = new Date(this.valueOf());
            dt.setDate(dt.getDate() + (6 - dt.getDay()));

            if (df.getMonth() === dt.getMonth())
                return true;
            else {
                return (df.getMonth() === this.getMonth() && dt.getDate() < 4)
					|| (df.getMonth() != this.getMonth() && dt.getDate() >= 4);
            }
        };
        Date.prototype.getDayForWeek = function () {
            var df = new Date(this.valueOf());
            df.setDate(df.getDate() - df.getDay());
            var dt = new Date(this.valueOf());
            dt.setDate(dt.getDate() + (6 - dt.getDay()));
            if ((df.getMonth() === dt.getMonth())
			 || (df.getMonth() != dt.getMonth() && dt.getDate() >= 4)) {
                return new Date(dt.setDate(dt.getDate() - 3));
            } else {
                return new Date(df.setDate(df.getDate() + 3));
            }
        };

        /**
        * Core functions for creating grid.
        */
        var core = {
            /**
            * Create header
            */
            create: function (element) {
                /**
                * Retrieve data
                */
                $.ajaxSetup({ scriptCharset: "utf-8", contentType: "application/json; charset=utf-8" });
                if (typeof settings.source !== "string") {
                    element.data = settings.source;
                    core.init(element);
                } else {
                    $.getJSON(settings.source, function (jsData) {
                        element.data = jsData;
                        core.init(element);
                    });
                }
            },
            init: function (element) {
                element.rowsNum = element.data.length;
                element.pageCount = Math.ceil(element.rowsNum / settings.itemsPerPage);
                element.rowsOnLastPage = element.rowsNum - (Math.floor(element.rowsNum / settings.itemsPerPage) * settings.itemsPerPage);

                element.dateStart = tools.getMinDate(element);
                element.dateEnd = tools.getMaxDate(element);

                core.render(element);
                core.waitToggle(element, true, function () { core.render(element); });
            },
            render: function (element) {
                var content = $('<div class="fn-content"/>');

                content.append(core.leftPanel(element));
                var $rightPanel = core.rightPanel(element);

                content.append($rightPanel);
                content.append(core.navigation(element));

                var $dataPanel = $rightPanel.find(".dataPanel");

                element.gantt = $('<div class="fn-gantt" />').append(content);

                $(element).html(element.gantt);

                element.scrollNavigation.panelMargin = parseInt($dataPanel.css("margin-left").replace("px", ""));
                element.scrollNavigation.panelMaxPos = ($dataPanel.width() - $rightPanel.width());

                element.scrollNavigation.canScroll = ($dataPanel.width() > $rightPanel.width());

                core.markNow(element);
                core.fillData(element);

                var d = Math.round((settings.startPos / 1000 - element.dateStart / 1000) / 86400) - 2;
                if (d > 0 && element.hPosition != 0) {
                    if (element.scaleOldWidth) {
                        var mLeft = ($dataPanel.width() - $rightPanel.width());
                        var hPos = mLeft * element.hPosition / element.scaleOldWidth;
                        hPos = hPos > 0 ? 0 : hPos;
                        $dataPanel.css({ "margin-left": hPos + "px" });
                        element.scrollNavigation.panelMargin = hPos;
                        element.hPosition = hPos;
                        element.scaleOldWidth = null;
                    } else {
                        $dataPanel.css({ "margin-left": element.hPosition + "px" });
                        element.scrollNavigation.panelMargin = element.hPosition;
                    }
                    core.repositionLabel(element);
                } else {
                    core.repositionLabel(element);
                }

                core.waitToggle(element, false);
            },
            leftPanel: function (element) {
                /* Left panel */
                var ganttLeftPanel = $('<div class="leftPanel"/>')
					.append($('<div class="row spacer"/>')
					.css("height", tools.getCellSize() * element.headerRows + "px")
					.css("width", "100%"));

                $.each(element.data, function (i, entry) {
                    if (i >= element.pageNum * settings.itemsPerPage && i < (element.pageNum * settings.itemsPerPage + settings.itemsPerPage)) {
                        ganttLeftPanel
							.append($('<div class="row name row' + i + ' "/>').append($('<span class="fn-label"/>').html(entry.name)))
							.append($('<div class="row desc row' + i + ' "/>').append($('<span class="fn-label"/>').html(entry.desc)));
                    }
                });
                return ganttLeftPanel;
            },
            dataPanel: function (element, width) {
                var dataPanel = $('<div class="dataPanel" style="width: ' + width + 'px;"/>');
                /*
                * Mouse wheel events
                */
                var mousewheelevt = (/Firefox/i.test(navigator.userAgent)) ? "DOMMouseScroll" : "mousewheel";

                if (document.attachEvent)
                    element.attachEvent("on" + mousewheelevt, function (e) { core.wheelScroll(element, e); });
                else if (document.addEventListener)
                    element.addEventListener(mousewheelevt, function (e) { core.wheelScroll(element, e); }, false);
                /*
                * Dragging datapanel 
                */

                dataPanel.mousedown(function (e) {
                    if (e.which != 1)
                        return true;
                    if (e.preventDefault) e.preventDefault();
                    element.scrollNavigation.panelMouseDown = true;
                    core.mouseScroll(element, e);
                })
					.mousemove(function (e) {
					    if (element.scrollNavigation.panelMouseDown) {
					        core.mouseScroll(element, e);
					    }
					});

                $(document).mouseup(function (e) {
                    if (e.which != 1)
                        return true;
                    element.scrollNavigation.panelMouseDown = false;
                    element.scrollNavigation.mouseX = null;
                    var $dataPanel = $(element).find(".fn-gantt .dataPanel");
                    $dataPanel.css("cursor", "auto");

                    core.repositionLabel(element);
                });
                return dataPanel;
            },
            // Creates Data container with header
            rightPanel: function (element) {

                var range = null;
                var dowClass = [" sn", " wd", " wd", " wd", " wd", " wd", " sa"];
                var gridDowClass = [" sn", "", "", "", "", "", " sa"];

                var years = $('<div class="row"/>');
                var daysInYear = 0;

                var months = $('<div class="row"/>');
                var daysInMonth = 0;

                var daysStr = "";
                var hoursInDay = 0;

                var dowStr = "";
                var horStr = "";

                var today = new Date();
                today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                var holidays = settings.holidays ? settings.holidays.join() : '';

                switch (settings.scale) {
                    // hours /////////////////////////////////////////////////////////////////////////////////////////    
                    case "hours":

                        range = tools.parseTimeRange(element.dateStart, element.dateEnd, element.scaleStep);

                        var year = range[0].getFullYear();
                        var month = range[0].getMonth();
                        var day = range[0];

                        for (var i = 0; i < range.length; i++) {
                            var rday = range[i];
                            /*
                            * Fill years
                            */
                            var rfy = rday.getFullYear();
                            if (rfy != year) {
                                years.html(years.html() +
									$('<div class="row header year" style="width: '
										+ tools.getCellSize() * daysInYear
										+ 'px;"><div class="fn-label">'
										+ year
										+ '</div></div>'));
                                year = rfy;
                                daysInYear = 0;
                            }
                            daysInYear++;

                            /*
                            * Fill months
                            */
                            var rm = rday.getMonth();
                            if (rm != month) {
                                months.append(
									$('<div class="row header month" style="width: '
									+ tools.getCellSize() * daysInMonth + 'px"><div class="fn-label">'
									+ settings.months[month]
									+ '</div></div>'));
                                month = rm;
                                daysInMonth = 0;
                            }
                            daysInMonth++;

                            /*
                            * Fill days & hours
                            */
                            var rgetDay = rday.getDay();
                            var getDay = day.getDay();
                            var day_class = dowClass[rgetDay];
                            var getTime = day.getTime();
                            if (holidays.indexOf((new Date(rday.getFullYear(), rday.getMonth(), rday.getDate())).getTime()) > -1)

                                day_class = "holiday";

                            if (rgetDay != getDay) {

                                var day_class2 = (today - day === 0) ? ' today' : (holidays.indexOf(getTime) > -1) ? "holiday" : dowClass[getDay];

                                daysStr += '<div class="row day ' + day_class2 + '" '
								        + ' style="width: ' + tools.getCellSize() * hoursInDay + 'px;"> '
								        + ' <div class="fn-label">' + day.getDate() + '</div></div>';

                                dowStr += '<div class="row day ' + day_class2 + '" '
								        + ' style="width: ' + tools.getCellSize() * hoursInDay + 'px;"> '
								        + ' <div class="fn-label">' + settings.dow[getDay] + '</div></div>';

                                day = rday;
                                hoursInDay = 0;
                            }
                            hoursInDay++;

                            horStr += '<div class="row day '
									+ day_class
									+ '" id="dh-'
									+ rday.getTime()
									+ '"> '
									+ rday.getHours()
									+ '</div>';
                        }

                        /*
                        * Last year
                        */
                        years.html(years.html() +
							'<div class="row header year" style="width: '
							+ tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">'
							+ year
							+ '</div></div>');
                        /*
                        * Last month
                        */
                        months.html(months.html() +
							'<div class="row header month" style="width: '
							+ tools.getCellSize() * daysInMonth + 'px"><div class="fn-label">'
							+ settings.months[month]
							+ '</div></div>');

                        var day_class = dowClass[day.getDay()];

                        if (holidays.indexOf((new Date(day.getFullYear(), day.getMonth(), day.getDate())).getTime()) > -1)
                            day_class = "holiday";

                        daysStr += '<div class="row day ' + day_class + '" '
						        + ' style="width: ' + tools.getCellSize() * hoursInDay + 'px;"> '
						        + ' <div class="fn-label">' + day.getDate() + '</div></div>';

                        dowStr += '<div class="row day ' + day_class + '" '
						        + ' style="width: ' + tools.getCellSize() * hoursInDay + 'px;"> '
						        + ' <div class="fn-label">' + settings.dow[day.getDay()] + '</div></div>';

                        var dataPanel = core.dataPanel(element, range.length * tools.getCellSize());

                        /*
                        * Append panel elements
                        */
                        dataPanel.append(years);
                        dataPanel.append(months);
                        dataPanel.append($('<div class="row"/>').html(daysStr));
                        dataPanel.append($('<div class="row"/>').html(dowStr));
                        dataPanel.append($('<div class="row"/>').html(horStr));

                        /*
                        * Generate grid
                        */
                        for (var i = 0; i < element.data.length; i++) {
                            var entry = element.data[i];

                            if (i >= element.pageNum * settings.itemsPerPage && i < (element.pageNum * settings.itemsPerPage + settings.itemsPerPage)) {
                                var dRow = '<div class="row">';
                                for (var x = 0; x < range.length; x++) {
                                    var day = range[x];
                                    var todayCls = gridDowClass[day.getDay()];
                                    if (holidays.indexOf((new Date(day.getFullYear(), day.getMonth(), day.getDate())).getTime()) > -1)
                                        todayCls = " holiday";
                                    dRow += '<div class="row day' + todayCls + '" id="d' + i + '-' + tools.genId(day.getTime()) + '" ></div>';
                                };
                                //dataPanel.append(dRow);
                                dataPanel.html(dataPanel.html() + dRow + '</div>');
                            }
                        }

                        break;

                    // weeks /////////////////////////////////////////////////////////////////////////////////////////    
                    case "weeks":
                        range = tools.parseWeeksRange(element.dateStart, element.dateEnd);

                        var year = range[0].getFullYear();
                        var month = range[0].getMonth();
                        var day = range[0];

                        for (var i = 0; i < range.length; i++) {
                            var rday = range[i];
                            /*
                            * Fill years
                            */
                            if (rday.getFullYear() != year) {
                                years.append(
									$('<div class="row header year" style="width: '
										+ tools.getCellSize() * daysInYear
										+ 'px;"><div class="fn-label">'
										+ year
										+ '</div></div>'));
                                year = rday.getFullYear();
                                daysInYear = 0;
                            }
                            daysInYear++;

                            /*
                            * Fill months
                            */
                            if (rday.getMonth() != month) {
                                months.append(
									$('<div class="row header month" style="width:'
									   + tools.getCellSize() * daysInMonth
									   + 'px;"><div class="fn-label">'
									   + settings.months[month]
									   + '</div></div>'));
                                month = rday.getMonth();
                                daysInMonth = 0;
                            }
                            daysInMonth++;
                            /*
                            * Fill weeks
                            */
                            daysStr += '<div class="row day wd" '
									+ ' id="dh-' + rday.getFullYear() + '-' + rday.getWeekOfYear() + '"> '
							        + ' <div class="fn-label">' + rday.getWeekOfYear() + '</div></div>';
                        }

                        /*
                        * Last year
                        */
                        years.append(
							'<div class="row header year" style="width: '
							+ tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">'
							+ year
							+ '</div></div>');
                        /*
                        * Last month
                        */
                        months.append(
							'<div class="row header month" style="width: '
							+ tools.getCellSize() * daysInMonth + 'px"><div class="fn-label">'
							+ settings.months[month]
							+ '</div></div>');

                        var dataPanel = core.dataPanel(element, range.length * tools.getCellSize());

                        /*
                        * Append panel elements
                        */
                        dataPanel.append(years);
                        dataPanel.append(months);
                        dataPanel.append($('<div class="row"/>').html(daysStr));
                        dataPanel.append($('<div class="row"/>').html(dowStr));

                        /*
                        * Generate grid
                        */
                        for (var i = 0; i < element.data.length; i++) {
                            var entry = element.data[i];

                            if (i >= element.pageNum * settings.itemsPerPage && i < (element.pageNum * settings.itemsPerPage + settings.itemsPerPage)) {
                                var dRow = '<div class="row">';
                                for (var x = 0; x < range.length; x++) {
                                    day = range[x];
                                    dRow += '<div class="row day" id="d' + i + '-' + tools.genId(day.getTime()) + '"></div>';
                                };
                                dataPanel.append($(dRow + '</div>'));
                            }
                        }


                        break;
                    // months ////////////////////////////////////////////////////////////////////////////////////////    
                    case 'months':
                        range = tools.parseMonthsRange(element.dateStart, element.dateEnd);

                        var year = range[0].getFullYear();
                        var month = range[0].getMonth();
                        var day = range[0];

                        for (var i = 0; i < range.length; i++) {
                            var rday = range[i];
                            /*
                            * Fill years
                            */
                            if (rday.getFullYear() != year) {
                                years.append(
									$('<div class="row header year" style="width: '
										+ tools.getCellSize() * daysInYear
										+ 'px;"><div class="fn-label">'
										+ year
										+ '</div></div>'));
                                year = rday.getFullYear();
                                daysInYear = 0;
                            }
                            daysInYear++;

                            months.append($('<div class="row day wd" id="dh-' + tools.genId(rday.getTime()) + '" />').html(rday.getMonth() + 1));

                        }

                        /*
                        * Last year
                        */
                        years.append(
							'<div class="row header year" style="width: '
							+ tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">'
							+ year
							+ '</div></div>');
                        /*
                        * Last month
                        */
                        months.append(
							'<div class="row header month" style="width: '
							+ tools.getCellSize() * daysInMonth + 'px">"<div class="fn-label">'
							+ settings.months[month]
							+ '</div></div>');

                        var dataPanel = core.dataPanel(element, range.length * tools.getCellSize());

                        /*
                        * Append panel elements
                        */
                        dataPanel.append(years);
                        dataPanel.append(months);
                        dataPanel.append($('<div class="row"/>').html(daysStr));
                        dataPanel.append($('<div class="row"/>').html(dowStr));

                        /*
                        * Generate grid
                        */
                        for (var i = 0; i < element.data.length; i++) {
                            var entry = element.data[i];

                            if (i >= element.pageNum * settings.itemsPerPage && i < (element.pageNum * settings.itemsPerPage + settings.itemsPerPage)) {
                                var dRow = '<div class="row">';
                                for (var x = 0; x < range.length; x++) {
                                    day = range[x];
                                    dRow += '<div class="row day" id="d' + i + '-' + tools.genId(day.getTime()) + '" ></div>';
                                };
                                dataPanel.append($(dRow + '</div>'));
                            }
                        }

                        break;
                    // days //////////////////////////////////////////////////////////////////////////////////////////    
                    default:
                        range = tools.parseDateRange(element.dateStart, element.dateEnd);

                        var year = range[0].getFullYear();
                        var month = range[0].getMonth();
                        var day = range[0];

                        for (var i = 0; i < range.length; i++) {
                            var rday = range[i];
                            /*
                            * Fill years
                            */
                            if (rday.getFullYear() != year) {
                                years.append(
									$('<div class="row header year" style="width:'
										+ tools.getCellSize() * daysInYear
										+ 'px;"><div class="fn-label">'
										+ year
										+ '</div></div>'));
                                year = rday.getFullYear();
                                daysInYear = 0;
                            }
                            daysInYear++;

                            /*
                            * Fill months
                            */
                            if (rday.getMonth() != month) {
                                months.append(
									$('<div class="row header month" style="width:'
									   + tools.getCellSize() * daysInMonth
									   + 'px;"><div class="fn-label">'
									   + settings.months[month]
									   + '</div></div>'));
                                month = rday.getMonth();
                                daysInMonth = 0;
                            }
                            daysInMonth++;

                            var getDay = rday.getDay();
                            var day_class = dowClass[getDay];
                            if (holidays.indexOf((new Date(rday.getFullYear(), rday.getMonth(), rday.getDate())).getTime()) > -1)
                                day_class = "holiday";

                            daysStr += '<div class="row day ' + day_class + '" '
							        + ' id="dh-' + tools.genId(rday.getTime()) + ' "> '
							        + ' <div class="fn-label">' + rday.getDate() + '</div></div>';
                            dowStr += '<div class="row day ' + day_class + '" '
							        + ' id="dw-' + tools.genId(rday.getTime()) + '"> '
							        + ' <div class="fn-label">' + settings.dow[getDay] + '</div></div>';
                        } //for

                        /*
                        * Last year
                        */
                        years.append(
							'<div class="row header year" style="width: '
							+ tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">'
							+ year
							+ '</div></div>');
                        /*
                        * Last month
                        */
                        months.append(
							'<div class="row header month" style="width: '
							+ tools.getCellSize() * daysInMonth + 'px"><div class="fn-label">'
							+ settings.months[month]
							+ '</div></div>');

                        var dataPanel = core.dataPanel(element, range.length * tools.getCellSize());

                        /*
                        * Append panel elements
                        */
                        dataPanel.append(years);
                        dataPanel.append(months);
                        dataPanel.append($('<div class="row"/>').html(daysStr));
                        dataPanel.append($('<div class="row"/>').html(dowStr));

                        /*
                        * Generate grid
                        */
                        for (var i = 0; i < element.data.length; i++) {
                            var entry = element.data[i];

                            if (i >= element.pageNum * settings.itemsPerPage && i < (element.pageNum * settings.itemsPerPage + settings.itemsPerPage)) {
                                var dRow = '<div class="row">';
                                for (var x = 0; x < range.length; x++) {
                                    day = range[x];
                                    var todayCls = gridDowClass[day.getDay()];
                                    if (holidays.indexOf((new Date(day.getFullYear(), day.getMonth(), day.getDate())).getTime()) > -1)
                                        todayCls = " holiday";
                                    dRow += '<div class="row day ' + todayCls + '" id="d' + i + '-' + tools.genId(day.getTime()) + '"></div>';
                                };
                                dataPanel.append($(dRow + '</div>'));
                            }
                        }

                        break;
                }

                return $('<div class="rightPanel"></div>').append(dataPanel);
            },
            navigation: function (element) {
                var ganttNavigate = null;
                if (settings.navigate === "scroll") {
                    ganttNavigate = $('<div class="navigate" />')
						.append($('<div class="nav-slider" />')
							.append($('<div class="nav-slider-left" />')
								.append($('<span role="button" class="nav-link nav-page-back"/>')
									.html('&lt;')
									.click(function () {
									    core.navigatePage(element, -1);
									}))
								.append($('<div class="page-number"/>')
										.append($('<span/>')
											.html(element.pageNum + 1 + ' of ' + element.pageCount)))
								.append($('<span role="button" class="nav-link nav-page-next"/>')
									.html('&gt;')
									.click(function () {
									    core.navigatePage(element, 1);
									}))
								.append($('<span role="button" class="nav-link nav-now"/>')
									.html('&#9679;')
									.click(function () {
									    core.navigateTo(element, 'now');
									}))
								.append($('<span role="button" class="nav-link nav-prev-day"/>')
									.html('&lt;')
									.click(function () {
									    core.navigateTo(element, tools.getCellSize());
									})))
							.append($('<div class="nav-slider-content" />')
									.append($('<div class="nav-slider-bar" />')
											.append($('<a class="nav-slider-button" />')
												)
												.mousedown(function (e) {
												    if (e.preventDefault) e.preventDefault();
												    element.scrollNavigation.scrollerMouseDown = true;
												    core.sliderScroll(element, e);
												})
												.mousemove(function (e) {
												    if (element.scrollNavigation.scrollerMouseDown) {
												        core.sliderScroll(element, e);
												    }
												})
											)
										)
							.append($('<div class="nav-slider-right" />')
								.append($('<span role="button" class="nav-link nav-next-day"/>')
									.html('&gt;')
									.click(function () {
									    core.navigateTo(element, tools.getCellSize() * -1);
									}))
								.append($('<span role="button" class="nav-link nav-zoomIn"/>')
									.html('&#43;')
									.click(function () {
									    core.zoomInOut(element, -1)
									}))
								.append($('<span role="button" class="nav-link nav-zoomOut"/>')
									.html('&#45;')
									.click(function () {
									    core.zoomInOut(element, 1);
									}))
									)
								);
                    $(document).mouseup(function () {
                        element.scrollNavigation.scrollerMouseDown = false;
                    });
                } else {
                    /* Navigation panel */
                    ganttNavigate = $('<div class="navigate" />')
						.append($('<span role="button" class="nav-link nav-page-back"/>')
							.html('&lt;')
							.click(function () {
							    core.navigatePage(element, -1);
							}))
						.append($('<div class="page-number"/>')
								.append($('<span/>')
									.html(element.pageNum + 1 + ' of ' + element.pageCount)))
						.append($('<span role="button" class="nav-link nav-page-next"/>')
							.html('&gt;')
							.click(function () {
							    core.navigatePage(element, 1);
							}))
						.append($('<span role="button" class="nav-link nav-begin"/>')
							.html('&#124;&lt;')
							.click(function () {
							    core.navigateTo(element, 'begin');
							}))
						.append($('<span role="button" class="nav-link nav-prev-week"/>')
							.html('&lt;&lt;')
							.click(function () {
							    core.navigateTo(element, tools.getCellSize() * 7);
							}))
						.append($('<span role="button" class="nav-link nav-prev-day"/>')
							.html('&lt;')
							.click(function () {
							    core.navigateTo(element, tools.getCellSize());
							}))
						.append($('<span role="button" class="nav-link nav-now"/>')
							.html('&#9679;')
							.click(function () {
							    core.navigateTo(element, 'now');
							}))
						.append($('<span role="button" class="nav-link nav-next-day"/>')
							.html('&gt;')
							.click(function () {
							    core.navigateTo(element, tools.getCellSize() * -1);
							}))
						.append($('<span role="button" class="nav-link nav-next-week"/>')
							.html('&gt;&gt;')
							.click(function () {
							    core.navigateTo(element, tools.getCellSize() * -7);
							}))
						.append($('<span role="button" class="nav-link nav-end"/>')
							.html('&gt;&#124;')
							.click(function () {
							    core.navigateTo(element, 'end');
							}))
						.append($('<span role="button" class="nav-link nav-zoomIn"/>')
							.html('&#43;')
							.click(function () {
							    core.zoomInOut(element, -1)
							}))
						.append($('<span role="button" class="nav-link nav-zoomOut"/>')
							.html('&#45;')
							.click(function () {
							    core.zoomInOut(element, 1);
							}));
                }
                return $('<div class="bottom"/>').append(ganttNavigate);
            },
            createProgressBar: function (days, cls, desc, label, dataObj) {
                var cellWidth = tools.getCellSize();
                var barMarg = tools.getProgressBarMargin() || 0;
                var bar = $('<div class="bar"><div class="fn-label">' + label + '</div></div>')
						.addClass(cls)
						.css({
						    width: ((cellWidth * days) - barMarg)
						})
						.data("dataObj", dataObj);

                if (desc) {
                    bar
					  .mouseover(function (e) {
					      var hint = $('<div class="fn-gantt-hint" />').html(desc);
					      $("body").append(hint);
					      hint.css("left", e.pageX);
					      hint.css("top", e.pageY);
					      hint.show();
					  })
					  .mouseout(function () {
					      $(".fn-gantt-hint").remove();
					  })
					  .mousemove(function (e) {
					      $(".fn-gantt-hint").css("left", e.pageX);
					      $(".fn-gantt-hint").css("top", e.pageY + 15);
					  });
                }
                return bar;
            },
            markNow: function (element) {
                switch (settings.scale) {
                    case "weeks":
                        var cd = Date.parse(new Date());
                        cd = (Math.floor(cd / 36400000) * 36400000);
                        $(element).find(':findweek("' + cd + '")').removeClass('wd').addClass('today');
                        break;
                    case "months":
                        $(element).find(':findmonth("' + new Date().getTime() + '")').removeClass('wd').addClass('today');
                        break;
                    default:
                        var cd = Date.parse(new Date());
                        cd = (Math.floor(cd / 36400000) * 36400000);
                        $(element).find(':findday("' + cd + '")').removeClass('wd').addClass('today');
                        break;
                }
            },
            fillData: function (element) {
                var invertColor = function (colStr) {
                    try {
                        colStr = colStr.replace("rgb(", "").replace(")", "");
                        var rgbArr = colStr.split(",");
                        var R = parseInt(rgbArr[0]);
                        var G = parseInt(rgbArr[1]);
                        var B = parseInt(rgbArr[2]);
                        var gray = Math.round((255 - (0.299 * R + 0.587 * G + 0.114 * B)) * 0.9, 1);
                        return "rgb(" + gray + ", " + gray + ", " + gray + ")";
                    } catch (err) {
                        return "";
                    }
                };
                $.each(element.data, function (i, entry) {
                    if (i >= element.pageNum * settings.itemsPerPage && i < (element.pageNum * settings.itemsPerPage + settings.itemsPerPage)) {
                        $.each(entry.values, function (j, day) {
                            var _bar = null;
                            switch (settings.scale) {
                                case "hours":
                                    var dFrom = tools.genId(tools.dateDeserialize(day.from).getTime(), element.scaleStep);
                                    var dTo = tools.genId(tools.dateDeserialize(day.to).getTime(), element.scaleStep);

                                    var cFrom = $(element).find("#d" + i + "-" + dFrom).offset().left;
                                    var cTo = $(element).find("#d" + i + "-" + dTo).offset().left;
                                    var dl = Math.floor((cTo - cFrom) / tools.getCellSize()) + 1;

                                    _bar = core.createProgressBar(
												dl,
												day.customClass ? day.customClass : "",
												day.desc ? day.desc : "",
												day.label ? day.label : "",
												day.dataObj ? day.dataObj : null
											);
                                    $(element).find("#d" + i + "-" + tools.genId(tools.dateDeserialize(day.from).getTime(), element.scaleStep))
									.append(_bar);
                                    break;
                                case "weeks":
                                case "months":
                                    var dFrom = tools.genId(tools.dateDeserialize(day.from).getTime());
                                    var dTo = tools.genId(tools.dateDeserialize(day.to).getTime());
                                    var cFrom = $(element).find("#d" + i + "-" + dFrom).offset().left;
                                    var cTo = $(element).find("#d" + i + "-" + dTo).offset().left;
                                    var dl = Math.round((cTo - cFrom) / tools.getCellSize()) + 1;

                                    _bar = core.createProgressBar(
											 dl,
											 day.customClass ? day.customClass : "",
											 day.desc ? day.desc : "",
											 day.label ? day.label : "",
											day.dataObj ? day.dataObj : null
										);
                                    $(element).find("#d" + i + "-" + tools.genId(tools.dateDeserialize(day.from).getTime(), element.scaleStep))
									.append(_bar);
                                    break;
                                default:
                                    var dFrom = tools.genId(tools.dateDeserialize(day.from).getTime());
                                    var dTo = tools.genId(tools.dateDeserialize(day.to).getTime());
                                    var dl = Math.floor(((dTo / 1000) - (dFrom / 1000)) / 86400) + 1;
                                    _bar = core.createProgressBar(
												dl,
												day.customClass ? day.customClass : "",
												day.desc ? day.desc : "",
												day.label ? day.label : "",
												day.dataObj ? day.dataObj : null
										);
                                    var $cell = $(element).find("#d" + i + "-" + tools.genId(tools.dateDeserialize(day.from).getTime()));
                                    $cell.append(_bar);
                                    break;
                            }
                            var $l = _bar.find(".fn-label");
                            if ($l && _bar.length) {
                                var gray = invertColor(_bar[0].style.backgroundColor);
                                $l.css("color", gray);
                            } else if ($l) {
                                $l.css("color", "");
                            }
                        });
                    }
                });
            },
            navigateTo: function (element, val) {
                var $rightPanel = $(element).find(".fn-gantt .rightPanel");
                var $dataPanel = $rightPanel.find(".dataPanel");
                var rightPanelWidth = $rightPanel.width();
                var dataPanelWidth = $dataPanel.width();

                switch (val) {
                    case "begin":
                        $dataPanel.animate({
                            "margin-left": "0px"
                        }, "fast", function () { core.repositionLabel(element); });
                        element.scrollNavigation.panelMargin = 0;
                        break;
                    case "end":
                        var mLeft = dataPanelWidth - rightPanelWidth;
                        element.scrollNavigation.panelMargin = mLeft * -1;
                        $dataPanel.animate({
                            "margin-left": "-" + mLeft + "px"
                        }, "fast", function () { core.repositionLabel(element); });
                        break;
                    case "now":
                        if (!element.scrollNavigation.canScroll)
                            return false;
                        var max_left = (dataPanelWidth - rightPanelWidth) * -1;
                        var cur_marg = $dataPanel.css("margin-left").replace("px", "");
                        var val = $dataPanel.find(".today").offset().left - $dataPanel.offset().left;
                        val *= -1;
                        if (val > 0)
                            val = 0;
                        else if (val < max_left)
                            val = max_left;

                        $dataPanel.animate({
                            "margin-left": val + "px"
                        }, "fast", core.repositionLabel(element));
                        element.scrollNavigation.panelMargin = val;
                        break;
                    default:
                        var max_left = (dataPanelWidth - rightPanelWidth) * -1;
                        var cur_marg = $dataPanel.css("margin-left").replace("px", "");
                        var val = parseInt(cur_marg) + val;
                        if (val <= 0 && val >= max_left)
                            $dataPanel.animate({
                                "margin-left": val + "px"
                            }, "fast", core.repositionLabel(element));
                        element.scrollNavigation.panelMargin = val;
                        break;
                }
            },
            navigatePage: function (element, val) {
                if ((element.pageNum + val) >= 0 && (element.pageNum + val) < Math.ceil(element.rowsNum / settings.itemsPerPage)) {
                    core.waitToggle(element, true, function () {
                        element.pageNum += val;
                        element.hPosition = $(".fn-gantt .dataPanel").css("margin-left").replace("px", "");
                        element.scaleOldWidth = false;
                        core.init(element);
                    });
                }
            },
            zoomInOut: function (element, val) {
                core.waitToggle(element, true, function () {

                    var zoomIn = (val < 0);

                    var scaleSt = element.scaleStep + val * 3;
                    scaleSt = scaleSt <= 1 ? 1 : scaleSt === 4 ? 3 : scaleSt;
                    var scale = settings.scale;
                    var headerRows = element.headerRows;
                    if (settings.scale === "hours" && scaleSt >= 13) {
                        scale = "days";
                        headerRows = 4;
                        scaleSt = 13;
                    } else if (settings.scale === "days" && zoomIn) {
                        scale = "hours";
                        headerRows = 5;
                        scaleSt = 12;
                    } else if (settings.scale === "days" && !zoomIn) {
                        scale = "weeks";
                        headerRows = 3;
                        scaleSt = 13;
                    } else if (settings.scale === "weeks" && !zoomIn) {
                        scale = "months";
                        headerRows = 2;
                        scaleSt = 14;
                    } else if (settings.scale === "weeks" && zoomIn) {
                        scale = "days";
                        headerRows = 4;
                        scaleSt = 13;
                    } else if (settings.scale === "months" && zoomIn) {
                        scale = "weeks";
                        headerRows = 3;
                        scaleSt = 13;
                    }

                    if ((zoomIn && $.inArray(scale, scales) < $.inArray(settings.minScale, scales))
						|| (!zoomIn && $.inArray(scale, scales) > $.inArray(settings.maxScale, scales))) {
                        core.init(element);
                        return;
                    }
                    element.scaleStep = scaleSt;
                    settings.scale = scale;
                    element.headerRows = headerRows;
                    var $rightPanel = $(element).find(".fn-gantt .rightPanel");
                    var $dataPanel = $rightPanel.find(".dataPanel");
                    element.hPosition = $dataPanel.css("margin-left").replace("px", "");
                    element.scaleOldWidth = ($dataPanel.width() - $rightPanel.width());

                    core.init(element);
                });
            },
            mouseScroll: function (element, e) {
                var $dataPanel = $(element).find(".fn-gantt .dataPanel");
                $dataPanel.css("cursor", "move");
                var bPos = $dataPanel.offset();
                var mPos = element.scrollNavigation.mouseX === null ? e.pageX : element.scrollNavigation.mouseX;
                var delta = e.pageX - mPos;
                element.scrollNavigation.mouseX = e.pageX;

                core.scrollPanel(element, delta);

                clearTimeout(element.scrollNavigation.repositionDelay);
                element.scrollNavigation.repositionDelay = setTimeout(core.repositionLabel, 50, element);
            },
            wheelScroll: function (element, e) {
                var delta = e.detail ? e.detail * (-50) : e.wheelDelta / 120 * 50;

                core.scrollPanel(element, delta);

                clearTimeout(element.scrollNavigation.repositionDelay);
                element.scrollNavigation.repositionDelay = setTimeout(core.repositionLabel, 50, element);

                if (e.preventDefault)
                    e.preventDefault();
                else
                    return false;

            },
            sliderScroll: function (element, e) {
                var $sliderBar = $(element).find(".nav-slider-bar");
                var $sliderBarBtn = $sliderBar.find(".nav-slider-button");
                var $rightPanel = $(element).find(".fn-gantt .rightPanel");
                var $dataPanel = $rightPanel.find(".dataPanel");

                var bPos = $sliderBar.offset();
                var bWidth = $sliderBar.width();
                var wButton = $sliderBarBtn.width();

                if ((e.pageX >= bPos.left) && (e.pageX <= bPos.left + bWidth)) {
                    var pos = e.pageX - bPos.left;
                    var pos = pos - wButton / 2;
                    $sliderBarBtn.css("left", pos);

                    var mLeft = $dataPanel.width() - $rightPanel.width();

                    var pPos = pos * mLeft / bWidth * -1;
                    if (pPos >= 0) {
                        $dataPanel.css("margin-left", "0px");
                        element.scrollNavigation.panelMargin = 0;
                    } else if (pos >= bWidth - (wButton * 1)) {
                        $dataPanel.css("margin-left", mLeft * -1 + "px");
                        element.scrollNavigation.panelMargin = mLeft * -1;
                    } else {
                        $dataPanel.css("margin-left", pPos + "px");
                        element.scrollNavigation.panelMargin = pPos;
                    }
                    clearTimeout(element.scrollNavigation.repositionDelay);
                    element.scrollNavigation.repositionDelay = setTimeout(core.repositionLabel, 50, element);
                }
            },
            scrollPanel: function (element, delta) {
                if (!element.scrollNavigation.canScroll)
                    return false;
                var _panelMargin = parseInt(element.scrollNavigation.panelMargin) + delta;
                if (_panelMargin > 0) {
                    element.scrollNavigation.panelMargin = 0;
                    $(element).find(".fn-gantt .dataPanel").css("margin-left", element.scrollNavigation.panelMargin + "px");
                } else if (_panelMargin < element.scrollNavigation.panelMaxPos * -1) {
                    element.scrollNavigation.panelMargin = element.scrollNavigation.panelMaxPos * -1;
                    $(element).find(".fn-gantt .dataPanel").css("margin-left", element.scrollNavigation.panelMargin + "px");
                } else {
                    element.scrollNavigation.panelMargin = _panelMargin;
                    $(element).find(".fn-gantt .dataPanel").css("margin-left", element.scrollNavigation.panelMargin + "px");
                }
            },
            synchronizeScroller: function (element) {
                if (settings.navigate === "scroll") {
                    var $rightPanel = $(element).find(".fn-gantt .rightPanel");
                    var $dataPanel = $rightPanel.find(".dataPanel");
                    var $sliderBar = $(element).find(".nav-slider-bar");
                    var $sliderBtn = $sliderBar.find(".nav-slider-button");

                    var bWidth = $sliderBar.width();
                    var wButton = $sliderBtn.width();

                    var mLeft = $dataPanel.width() - $rightPanel.width();
                    var hPos = 0;
                    if ($dataPanel.css("margin-left"))
                        hPos = $dataPanel.css("margin-left").replace("px", "");
                    var pos = hPos * bWidth / mLeft - $sliderBtn.width() * 0.25;
                    pos = pos > 0 ? 0 : (pos * -1 >= bWidth - (wButton * 0.75)) ? (bWidth - (wButton * 1.25)) * -1 : pos;
                    $sliderBtn.css("left", pos * -1);
                }
            },
            repositionLabel: function (element) {
                var $rightPanel = $(".fn-gantt .rightPanel");
                var $dataPanel = $rightPanel.find(".dataPanel");
                $dataPanel.stop();

                var wrapper = { offset: $rightPanel.offset(),
                    width: $rightPanel.width(),
                    height: $rightPanel.height()
                };

                $(".fn-gantt .rightPanel .year, .fn-gantt .rightPanel .month").each(function (i, obj) {
                    var objDim = { offset: $(obj).offset(),
                        width: $(obj).width(),
                        height: $(obj).height()
                    };

                    if (objDim.offset.left + objDim.width > wrapper.offset.left
					        && objDim.offset.left < wrapper.offset.left + wrapper.width) {
                        var viewArea = {
                            left: objDim.offset.left > wrapper.offset.left ? objDim.offset.left : wrapper.offset.left,
                            right: objDim.offset.left + objDim.width < wrapper.offset.left + wrapper.width ? objDim.offset.left + objDim.width : wrapper.offset.left + wrapper.width
                        };
                        $(obj).children(".fn-label").css("float", "left");
                        var labelWidth = $(obj).children(".fn-label").width();

                        var objMarg = objDim.offset.left < wrapper.offset.left ? wrapper.offset.left - objDim.offset.left : 0;
                        if (viewArea.right - viewArea.left > labelWidth)
                            $(obj).children(".fn-label")
						    		.css("margin-left", objMarg + (viewArea.right - viewArea.left) / 2 - labelWidth / 2 + "px");
                    }
                });
                $(".fn-gantt .rightPanel .bar").each(function (i, obj) {
                    var objDim = { offset: $(obj).offset(),
                        width: $(obj).width(),
                        height: $(obj).height()
                    };

                    if (objDim.offset.left + objDim.width > wrapper.offset.left
					        && objDim.offset.left < wrapper.offset.left + wrapper.width) {
                        var viewArea = {
                            left: objDim.offset.left > wrapper.offset.left ? objDim.offset.left : wrapper.offset.left,
                            right: objDim.offset.left + objDim.width < wrapper.offset.left + wrapper.width ? objDim.offset.left + objDim.width : wrapper.offset.left + wrapper.width
                        };
                        $(obj).children(".fn-label").css("float", "left");
                        var labelWidth = $(obj).children(".fn-label").width();

                        var objMarg = objDim.offset.left < wrapper.offset.left ? wrapper.offset.left - objDim.offset.left : 0;
                        if (viewArea.right - viewArea.left > labelWidth)
                            $(obj).children(".fn-label")
						    		.css("margin-left", objMarg + (viewArea.right - viewArea.left) / 2 - labelWidth / 2 + "px");
                    }
                });
                core.synchronizeScroller(element);
            },
            waitToggle: function (element, show, fn) {
                if (show) {
                    var eo = $(element).offset();
                    var ew = $(element).outerWidth();
                    var eh = $(element).outerHeight();

                    if (!element.loader) {
                        element.loader = $('<div class="fn-gantt-loader" style="position: absolute; top: ' + eo.top + 'px; left: ' + eo.left + 'px; width: ' + ew + 'px; height: ' + eh + 'px;">'
						+ '<div class="fn-gantt-loader-spinner"><span>' + settings.waitText + '</span></div></div>');
                    }
                    $("body").append(element.loader);
                    setTimeout(fn, 100);

                } else {
                    if (element.loader)
                        element.loader.remove();
                    element.loader = null;
                }
            }
        };

        /**
        * Additional functions
        */
        var tools = {
            getMaxDate: function (element) {
                var maxDate = null;
                $.each(element.data, function (i, entry) {
                    $.each(entry.values, function (i, date) {
                        maxDate = maxDate < tools.dateDeserialize(date.to) ? tools.dateDeserialize(date.to) : maxDate;
                    });
                });

                switch (settings.scale) {
                    case "hours":
                        maxDate.setHours(Math.ceil((maxDate.getHours()) / element.scaleStep) * element.scaleStep);
                        maxDate.setHours(maxDate.getHours() + element.scaleStep * 3);
                        break;
                    case "weeks":
                        var bd = new Date(maxDate.getTime());
                        var bd = new Date(bd.setDate(bd.getDate() + 3 * 7));
                        var md = Math.floor(bd.getDate() / 7) * 7;
                        maxDate = new Date(bd.getFullYear(), bd.getMonth(), md === 0 ? 4 : md - 3);
                        break;
                    case "months":
                        var bd = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
                        bd.setMonth(bd.getMonth() + 2);
                        maxDate = new Date(bd.getFullYear(), bd.getMonth(), 1);
                        break;
                    default:
                        maxDate.setHours(0);
                        maxDate.setDate(maxDate.getDate() + 3);
                        break;
                }
                return maxDate;
            },
            getMinDate: function (element) {
                var minDate = null;
                $.each(element.data, function (i, entry) {
                    $.each(entry.values, function (i, date) {
                        minDate = minDate > tools.dateDeserialize(date.from) || minDate === null ? tools.dateDeserialize(date.from) : minDate;
                    });
                });
                switch (settings.scale) {
                    case "hours":
                        minDate.setHours(Math.floor((minDate.getHours()) / element.scaleStep) * element.scaleStep);
                        minDate.setHours(minDate.getHours() - element.scaleStep * 3);
                        break;
                    case "weeks":
                        var bd = new Date(minDate.getTime());
                        var bd = new Date(bd.setDate(bd.getDate() - 3 * 7));
                        var md = Math.floor(bd.getDate() / 7) * 7;
                        minDate = new Date(bd.getFullYear(), bd.getMonth(), md === 0 ? 4 : md - 3);
                        break;
                    case "months":
                        var bd = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                        bd.setMonth(bd.getMonth() - 3);
                        minDate = new Date(bd.getFullYear(), bd.getMonth(), 1);
                        break;
                    default:
                        minDate.setHours(0);
                        minDate.setDate(minDate.getDate() - 3);
                        //if (minDate.getDate() >= 27)
                        //	minDate.setDate(minDate.getDate() - element.headerRows);
                        break;
                }
                return minDate;
            },
            parseDateRange: function (from, to) {
                var current = new Date(from.getTime());
                var end = new Date(to.getTime()); ;
                var ret = new Array();
                var i = 0;
                do {
                    ret[i++] = new Date(current.getTime());
                    current.setDate(current.getDate() + 1);
                } while (current.getTime() <= to.getTime());
                return ret;

            },
            parseTimeRange: function (from, to, scaleStep) {
                var current = new Date(from);
                var end = new Date(to);

                var ret = new Array();
                var i = 0;
                do {
                    ret[i] = new Date(current.getTime());
                    current.setHours(current.getHours() + scaleStep);
                    current.setHours(Math.floor((current.getHours()) / scaleStep) * scaleStep);

                    if (current.getDay() != ret[i].getDay())
                        current.setHours(0);

                    i++;
                } while (current.getTime() <= to.getTime());
                return ret;
            },
            parseWeeksRange: function (from, to) {

                var current = new Date(from);
                var end = new Date(to);

                var ret = new Array();
                var i = 0;
                do {

                    if (current.getDay() === 0) {
                        ret[i++] = current.getDayForWeek();
                    }
                    current.setDate(current.getDate() + 1);
                } while (current.getTime() <= to.getTime());

                return ret;
            },
            parseMonthsRange: function (from, to) {

                var current = new Date(from);
                var end = new Date(to);

                var ret = new Array();
                var i = 0;
                do {
                    ret[i++] = new Date(current.getFullYear(), current.getMonth(), 1);
                    current.setMonth(current.getMonth() + 1);
                } while (current.getTime() <= to.getTime());

                return ret;
            },
            dateDeserialize: function (dateStr) {
                //return eval("new" + dateStr.replace(/\//g, " "));
                var date = eval("new" + dateStr.replace(/\//g, " "));
                return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes());
            },
            genId: function (ticks) {
                var t = new Date(ticks);
                switch (settings.scale) {
                    case "hours":
                        var hour = t.getHours();

                        if (arguments.length >= 2)
                            hour = (Math.floor((t.getHours()) / arguments[1]) * arguments[1]);
                        return (new Date(t.getFullYear(), t.getMonth(), t.getDate(), hour)).getTime();
                        break;
                    case "weeks":
                        return t.getFullYear() + "-" + t.getDayForWeek().getWeekOfYear();
                        break;
                    case "months":
                        return t.getFullYear() + "-" + t.getMonth();
                        break;
                    default:
                        return (new Date(t.getFullYear(), t.getMonth(), t.getDate())).getTime();
                        break;
                }
            },
            _getCellSize: null,
            getCellSize: function () {
                if (!tools._getCellSize) {
                    $("body").append(
						$('<div style="display: none; position: absolute;" class="fn-gantt" id="measureCellWidth"><div class="row"></div></div>')
					);
                    tools._getCellSize = $("#measureCellWidth .row").height();
                    $("#measureCellWidth").empty().remove();
                }
                return tools._getCellSize;
            },
            getRightPanelSize: function () {
                $("body").append(
					$('<div style="display: none; position: absolute;" class="fn-gantt" id="measureCellWidth"><div class="rightPanel"></div></div>')
				);
                var ret = $("#measureCellWidth .rightPanel").height();
                $("#measureCellWidth").empty().remove();
                return ret;
            },
            getPageHeight: function (element) {
                return element.pageNum + 1 === element.pageCount ? rowsOnLastPage * tools.getCellSize() : settings.itemsPerPage * tools.getCellSize();
            },
            _getProgressBarMargin: null,
            getProgressBarMargin: function () {
                if (!tools._getProgressBarMargin) {
                    $("body").append(
						$('<div style="display: none; position: absolute;" id="measureBarWidth" ><div class="fn-gantt"><div class="rightPanel"><div class="dataPanel"><div class="row day"><div class="bar" /></div></div></div></div></div>')
					);
                    tools._getProgressBarMargin = parseInt($("#measureBarWidth .fn-gantt .rightPanel .day .bar").css("margin-left").replace("px", ""));
                    tools._getProgressBarMargin += parseInt($("#measureBarWidth .fn-gantt .rightPanel .day .bar").css("margin-right").replace("px", ""));
                    $("#measureBarWidth").empty().remove();
                }
                return tools._getProgressBarMargin;
            }
        };

        this.each(function () {

            /**
            * Extend options with default values
            */
            if (options)
                $.extend(settings, options);

            this.data = null;        // Recived data
            this.pageNum = 0;        // Current page number
            this.pageCount = 0;      // Aviable pages count
            this.rowsOnLastPage = 0; // How many rows on last page
            this.rowsNum = 0;        //
            this.hPosition = 0;      // Current position on diagram (Horizontal)
            this.dateStart = null;
            this.dateEnd = null;
            this.scrollClicked = false;
            this.scaleOldWidth = null;

            this.headerRows = null;
            switch (settings.scale) {
                case "hours": this.headerRows = 5; this.scaleStep = 1; break;
                case "weeks": this.headerRows = 3; this.scaleStep = 13; break;
                case "months": this.headerRows = 2; this.scaleStep = 14; break;
                default: this.headerRows = 4; this.scaleStep = 13; break;
            }

            this.scrollNavigation = {
                panelMouseDown: false,
                scrollerMouseDown: false,
                mouseX: null,
                panelMargin: 0,
                repositionDelay: 0,
                panelMaxPos: 0,
                canScroll: true
            };

            this.gantt = null;
            this.loader = null;

            core.create(this);

        });

    };
})(jQuery);