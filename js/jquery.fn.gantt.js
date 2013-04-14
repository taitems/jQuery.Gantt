// jQuery Gantt Chart
// ==================

// Basic usage:

//      $(".selector").gantt({
//          source: "ajax/data.json",
//          scale: "weeks",
//          minScale: "weeks",
//          maxScale: "months",
//          onItemClick: function(data) {
//              alert("Item clicked - show some details");
//          },
//          onAddClick: function(dt, rowId) {
//              alert("Empty space clicked - add an item!");
//          },
//          onRender: function() {
//              console.log("chart rendered");
//          }
//      });

//
/*jshint shadow:true, unused:false, laxbreak:true, evil:true*/
/*globals jQuery, alert*/
(function($) {"use strict";

	var cookieKey = "jquery.fn.gantt";
	var scales = ["hours", "days", "weeks", "months"];

	/**
	 * Plugin name
	 */
	var pname = 'gantt';

	var defaults = {
		data : [], // Received data
		itemsPerPage : 7,
		months : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
		dow : ["S", "M", "T", "W", "T", "F", "S"],
		startPos : new Date(),
		navigate : "buttons",
		scale : "days",
		useCookie : false,
		maxScale : "months",
		minScale : "hours",
		waitText : "Please wait...",
		onItemClick : function(data) {
			return;
		},
		onAddClick : function(data) {
			return;
		},
		onRender : function() {
			return;
		},
		scrollToToday : true,

		pageNum : 0, // Current page number
		pageCount : 0, // Available pages count
		rowsOnLastPage : 0, // How many rows on last page
		rowsNum : 0, // Number of total rows
		hPosition : 0, // Current position on diagram (Horizontal)
		dateStart : null,
		dateEnd : null,
		scrollClicked : false,
		scaleOldWidth : null,
		headerRows : null,
		scaleStep : null,
		scrollNavigation : {
			panelMouseDown : false,
			scrollerMouseDown : false,
			mouseX : null,
			panelMargin : 0,
			repositionDelay : 0,
			panelMaxPos : 0,
			canScroll : true
		},

		gantt : null,
		loader : null
	};

	/**
	 * Available methods for the plugin
	 */
	var methods = {
		init : function(options) {
			var $this = $(this);
			var settings = $this.data(pname);

			// Extend options with default values
			if ( typeof (settings) == 'undefined') {
				settings = $.extend({}, defaults, options);
				$this.data(pname, settings);
			} else {
				settings = $.extend({}, settings, options);
			}

			return this.each(function() {
				var $this = $(this);

				if (settings.useCookie) {
					var sc = $.cookie(cookieKey + "CurrentScale");
					if (sc) {
						settings.scale = $.cookie(cookieKey + "CurrentScale");
					} else {
						$.cookie(cookieKey + "CurrentScale", settings.scale);
					}
				}

				switch (settings.scale) {
					case "hours":
						settings.headerRows = 5;
						settings.scaleStep = 1;
						break;
					case "weeks":
						settings.headerRows = 3;
						settings.scaleStep = 13;
						break;
					case "months":
						settings.headerRows = 2;
						settings.scaleStep = 14;
						break;
					default:
						settings.headerRows = 4;
						settings.scaleStep = 13;
						break;
				}

				core.create(this);
			});
		},

		addSource : function(source) {
			return this.each(function() {
				var $this = $(this);
				var settings = $this.data(pname);

				settings.data.push(source);
				core.init(this);
				core.render(this);
			});
		}
	};

	// Grid management
	// ===============

	// Core object is responsible for navigation and rendering
	var core = {
		// Return the element whose topmost point lies under the given point
		// Normalizes for IE
		elementFromPoint : function(x, y) {

			if ($.browser.msie) {
				x -= $(document).scrollLeft();
				y -= $(document).scrollTop();
			} else {
				x -= window.pageXOffset;
				y -= window.pageYOffset;
			}

			return document.elementFromPoint(x, y);
		},

		// **Create the chart**
		create : function(element) {

			// Initialize data with a json object or fetch via an xhr
			// request depending on `settings.source`
			var $this = $(element);
			var settings = $this.data(pname);

			if ( typeof settings.data !== "string") {
				core.init(element);
			} else {
				$.getJSON(settings.data, function(jsData) {
					settings.data = jsData;
					core.init(element);
				});
			}
		},

		// **Setup the initial view**
		// Here we calculate the number of rows, pages and visible start
		// and end dates once the data is ready
		init : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);

			if (!settings.data || !settings.data.length) {
				settings.rowsNum = 0;
				settings.pageCount = 1;
				settings.rowsOnLastPage = 0;

				var now = new Date();
				settings.dateStart = tools.getScaledMinDate(element, now);
				settings.dateEnd = tools.getScaledMinDate(element, now);
			} else {
				settings.rowsNum = settings.data.length;
				settings.pageCount = Math.ceil(settings.rowsNum / settings.itemsPerPage);
				settings.rowsOnLastPage = settings.rowsNum - (Math.floor(settings.rowsNum / settings.itemsPerPage) * settings.itemsPerPage);

				settings.dateStart = tools.getMinDate(element);
				settings.dateEnd = tools.getMaxDate(element);
			}

			/* core.render(element); */
			core.waitToggle(element, true, function() {
				core.render(element);
			});
		},

		// **Render the grid**
		render : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);

			if (!settings.data || !settings.data.length)
				return;

			var content = $('<div class="fn-content"/>');
			var $leftPanel = core.leftPanel(element);
			content.append($leftPanel);
			var $rightPanel = core.rightPanel(element, $leftPanel);
			var mLeft, hPos;

			content.append($rightPanel);
			content.append(core.navigation(element));

			var $dataPanel = $rightPanel.find(".dataPanel");

			settings.gantt = $('<div class="fn-gantt" />').append(content);

			$(element).html(settings.gantt);

			settings.scrollNavigation.panelMargin = parseInt($dataPanel.css("margin-left").replace("px", ""), 10);
			settings.scrollNavigation.panelMaxPos = ($dataPanel.width() - $rightPanel.width());

			settings.scrollNavigation.canScroll = ($dataPanel.width() > $rightPanel.width());

			core.markNow(element);
			core.fillData(element, $dataPanel, $leftPanel);

			// Set a cookie to record current position in the view
			if (settings.useCookie) {
				var sc = $.cookie(cookieKey + "ScrollPos");
				if (sc) {
					settings.hPosition = sc;
				}
			}

			// Scroll the grid to today's date
			if (settings.scrollToToday) {
				var startPos = Math.round((settings.startPos / 1000 - settings.dateStart / 1000) / 86400) - 2;
				if ((startPos > 0 && settings.hPosition !== 0)) {
					if (settings.scaleOldWidth) {
						mLeft = ($dataPanel.width() - $rightPanel.width());
						hPos = mLeft * settings.hPosition / settings.scaleOldWidth;
						hPos = hPos > 0 ? 0 : hPos;
						$dataPanel.css({
							"margin-left" : hPos + "px"
						});
						settings.scrollNavigation.panelMargin = hPos;
						settings.hPosition = hPos;
						settings.scaleOldWidth = null;
					} else {
						$dataPanel.css({
							"margin-left" : settings.hPosition + "px"
						});
						settings.scrollNavigation.panelMargin = settings.hPosition;
					}
					core.repositionLabel(element);
				} else {
					core.repositionLabel(element);
				}
				// or, scroll the grid to the left most date in the panel
			} else {
				if ((settings.hPosition !== 0)) {
					if (settings.scaleOldWidth) {
						mLeft = ($dataPanel.width() - $rightPanel.width());
						hPos = mLeft * settings.hPosition / settings.scaleOldWidth;
						hPos = hPos > 0 ? 0 : hPos;
						$dataPanel.css({
							"margin-left" : hPos + "px"
						});
						settings.scrollNavigation.panelMargin = hPos;
						settings.hPosition = hPos;
						settings.scaleOldWidth = null;
					} else {
						$dataPanel.css({
							"margin-left" : settings.hPosition + "px"
						});
						settings.scrollNavigation.panelMargin = settings.hPosition;
					}
					core.repositionLabel(element);
				} else {
					core.repositionLabel(element);
				}
			}

			$dataPanel.css({
				height : $leftPanel.height()
			});
			core.waitToggle(element, false);
			settings.onRender();
		},

		// Create and return the left panel with labels
		leftPanel : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);

			/* Left panel */
			var ganttLeftPanel = $('<div class="leftPanel"/>').append($('<div class="row spacer"/>').css("height", tools.getCellSize() * settings.headerRows + "px").css("width", "100%"));

			var entries = [];
			$.each(settings.data, function(i, entry) {
				if (i >= settings.pageNum * settings.itemsPerPage && i < (settings.pageNum * settings.itemsPerPage + settings.itemsPerPage)) {
					entries.push('<div class="row name row' + i + (entry.desc ? '' : ' fn-wide') + '" id="rowheader' + i + '" offset="' + i % settings.itemsPerPage * tools.getCellSize() + '">');
					entries.push('<span class="fn-label' + (entry.cssClass ? ' ' + entry.cssClass : '') + '">' + entry.name + '</span>');
					entries.push('</div>');

					if (entry.desc) {
						entries.push('<div class="row desc row' + i + ' " id="RowdId_' + i + '" data-id="' + entry.id + '">');
						entries.push('<span class="fn-label' + (entry.cssClass ? ' ' + entry.cssClass : '') + '">' + entry.desc + '</span>');
						entries.push('</div>');
					}

				}
			});
			ganttLeftPanel.append(entries.join(""));
			return ganttLeftPanel;
		},

		// Create and return the data panel element
		dataPanel : function(element, width) {
			var settings = $(element).data(pname);
			
			var dataPanel = $('<div class="dataPanel" style="width: ' + width + 'px;"/>');

			// Handle mousewheel events for scrolling the data panel
			var mousewheelevt = (/Firefox/i.test(navigator.userAgent)) ? "DOMMouseScroll" : "mousewheel";
			if (document.attachEvent) {
				element.attachEvent("on" + mousewheelevt, function(e) {
					core.wheelScroll(element, e);
				});
			} else if (document.addEventListener) {
				element.addEventListener(mousewheelevt, function(e) {
					core.wheelScroll(element, e);
				}, false);
			}

			// Handle click events and dispatch to registered `onAddClick`
			// function
			dataPanel.click(function(e) {
				e.stopPropagation();
				var corrX, corrY;
				var leftpanel = $(element).find(".fn-gantt .leftPanel");
				var datapanel = $(element).find(".fn-gantt .dataPanel");
				switch (settings.scale) {
					case "weeks":
						corrY = tools.getCellSize() * 2;
						break;
					case "months":
						corrY = tools.getCellSize();
						break;
					case "hours":
						corrY = tools.getCellSize() * 4;
						break;
					case "days":
						corrY = tools.getCellSize() * 3;
						break;
					default:
						corrY = tools.getCellSize() * 2;
						break;
				}

				/* Adjust, so get middle of elm
				corrY -= Math.floor(tools.getCellSize() / 2);
				*/

				// Find column where click occurred
				var col = core.elementFromPoint(e.pageX, datapanel.offset().top + corrY);
				// Was the label clicked directly?
				if (col.className === "fn-label") {
					col = $(col.parentNode);
				} else {
					col = $(col);
				}

				var dt = col.attr("repdate");
				// Find row where click occurred
				var row = core.elementFromPoint(leftpanel.offset().left + leftpanel.width() - 10, e.pageY);
				// Was the lable clicked directly?
				if (row.className.indexOf("fn-label") === 0) {
					row = $(row.parentNode);
				} else {
					row = $(row);
				}
				var rowId = row.data().id;

				// Dispatch user registered function with the DateTime in ms
				// and the id if the clicked object is a row
				settings.onAddClick(dt, rowId);
			});
			return dataPanel;
		},

		// Creates and return the right panel containing the year/week/day
		// header
		rightPanel : function(element, leftPanel) {
			var $this = $(element);
			var settings = $this.data(pname);
			var range = null;
			// Days of the week have a class of one of
			// `sn` (Saturday), `sa` (Sunday), or `wd` (Weekday)
			var dowClass = [" sn", " wd", " wd", " wd", " wd", " wd", " sa"];
			var gridDowClass = [" sn", "", "", "", "", "", " sa"];

			var yearArr = ['<div class="row"/>'];
			var daysInYear = 0;

			var monthArr = ['<div class="row"/>'];
			var daysInMonth = 0;

			var dayArr = [];

			var hoursInDay = 0;

			var dowArr = [];

			var horArr = [];

			var today = new Date();
			today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
			var holidays = settings.holidays ? settings.holidays.join() : '';

			// Setup the headings based on the chosen `settings.scale`
			switch (settings.scale) {
				// **Hours**
				case "hours":

					range = tools.parseTimeRange(settings.dateStart, settings.dateEnd, settings.scaleStep);

					var year = range[0].getFullYear();
					var month = range[0].getMonth();
					var day = range[0];

					for (var i = 0; i < range.length; i++) {
						var rday = range[i];

						// Fill years
						var rfy = rday.getFullYear();
						if (rfy !== year) {
							yearArr.push(('<div class="row header year" style="width: ' + tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">' + year + '</div></div>'));

							year = rfy;
							daysInYear = 0;
						}
						daysInYear++;

						// Fill months
						var rm = rday.getMonth();
						if (rm !== month) {
							monthArr.push(('<div class="row header month" style="width: ' + tools.getCellSize() * daysInMonth + 'px"><div class="fn-label">' + settings.months[month] + '</div></div>'));

							month = rm;
							daysInMonth = 0;
						}
						daysInMonth++;

						// Fill days & hours

						var rgetDay = rday.getDay();
						var getDay = day.getDay();
						var day_class = dowClass[rgetDay];
						var getTime = day.getTime();
						if (holidays.indexOf((new Date(rday.getFullYear(), rday.getMonth(), rday.getDate())).getTime()) > -1) {
							day_class = "holiday";
						}
						if (rgetDay !== getDay) {

							var day_class2 = (today - day === 0) ? ' today' : (holidays.indexOf(getTime) > -1) ? "holiday" : dowClass[getDay];

							dayArr.push('<div class="row date ' + day_class2 + '" ' + ' style="width: ' + tools.getCellSize() * hoursInDay + 'px;"> ' + ' <div class="fn-label">' + day.getDate() + '</div></div>');
							dowArr.push('<div class="row day ' + day_class2 + '" ' + ' style="width: ' + tools.getCellSize() * hoursInDay + 'px;"> ' + ' <div class="fn-label">' + settings.dow[getDay] + '</div></div>');

							day = rday;
							hoursInDay = 0;
						}
						hoursInDay++;

						horArr.push('<div class="row day ' + day_class + '" id="dh-' + rday.getTime() + '"  offset="' + i * tools.getCellSize() + '"  repdate="' + rday.genRepDate(settings.scale) + '"> ' + rday.getHours() + '</div>');
					}

					// Last year
					yearArr.push('<div class="row header year" style="width: ' + tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">' + year + '</div></div>');

					// Last month
					monthArr.push('<div class="row header month" style="width: ' + tools.getCellSize() * daysInMonth + 'px"><div class="fn-label">' + settings.months[month] + '</div></div>');

					var day_class = dowClass[day.getDay()];

					if (holidays.indexOf((new Date(day.getFullYear(), day.getMonth(), day.getDate())).getTime()) > -1) {
						day_class = "holiday";
					}

					dayArr.push('<div class="row date ' + day_class + '" ' + ' style="width: ' + tools.getCellSize() * hoursInDay + 'px;"> ' + ' <div class="fn-label">' + day.getDate() + '</div></div>');

					dowArr.push('<div class="row day ' + day_class + '" ' + ' style="width: ' + tools.getCellSize() * hoursInDay + 'px;"> ' + ' <div class="fn-label">' + settings.dow[day.getDay()] + '</div></div>');

					var dataPanel = core.dataPanel(element, range.length * tools.getCellSize());

					// Append panel elements
					dataPanel.append(yearArr.join(""));
					dataPanel.append(monthArr.join(""));
					dataPanel.append($('<div class="row"/>').html(dayArr.join("")));
					dataPanel.append($('<div class="row"/>').html(dowArr.join("")));
					dataPanel.append($('<div class="row"/>').html(horArr.join("")));

					break;

				// **Weeks**
				case "weeks":
					range = tools.parseWeeksRange(settings.dateStart, settings.dateEnd);
					yearArr = ['<div class="row"/>'];
					monthArr = ['<div class="row"/>'];
					var year = range[0].getFullYear();
					var month = range[0].getMonth();
					var day = range[0];

					for (var i = 0; i < range.length; i++) {
						var rday = range[i];

						// Fill years
						if (rday.getFullYear() !== year) {
							yearArr.push(('<div class="row header year" style="width: ' + tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">' + year + '</div></div>'));
							year = rday.getFullYear();
							daysInYear = 0;
						}
						daysInYear++;

						// Fill months
						if (rday.getMonth() !== month) {
							monthArr.push(('<div class="row header month" style="width:' + tools.getCellSize() * daysInMonth + 'px;"><div class="fn-label">' + settings.months[month] + '</div></div>'));
							month = rday.getMonth();
							daysInMonth = 0;
						}
						daysInMonth++;

						// Fill weeks
						dayArr.push('<div class="row day wd" ' + ' id="' + rday.getWeekId() + '" offset="' + i * tools.getCellSize() + '" repdate="' + rday.genRepDate(settings.scale) + '"> ' + ' <div class="fn-label">' + rday.getWeekOfYear() + '</div></div>');
					}

					// Last year
					yearArr.push('<div class="row header year" style="width: ' + tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">' + year + '</div></div>');

					// Last month
					monthArr.push('<div class="row header month" style="width: ' + tools.getCellSize() * daysInMonth + 'px"><div class="fn-label">' + settings.months[month] + '</div></div>');

					var dataPanel = core.dataPanel(element, range.length * tools.getCellSize());

					dataPanel.append(yearArr.join("") + monthArr.join("") + dayArr.join("") + (dowArr.join("")));

					break;

				// **Months**
				case 'months':
					range = tools.parseMonthsRange(settings.dateStart, settings.dateEnd);

					var year = range[0].getFullYear();
					var month = range[0].getMonth();
					var day = range[0];

					for (var i = 0; i < range.length; i++) {
						var rday = range[i];

						// Fill years
						if (rday.getFullYear() !== year) {
							yearArr.push(('<div class="row header year" style="width: ' + tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">' + year + '</div></div>'));
							year = rday.getFullYear();
							daysInYear = 0;
						}
						daysInYear++;
						monthArr.push('<div class="row day wd" id="dh-' + tools.genId(settings.scale, rday.getTime()) + '" offset="' + i * tools.getCellSize() + '" repdate="' + rday.genRepDate(settings.scale) + '">' + (1 + rday.getMonth()) + '</div>');
					}

					// Last year
					yearArr.push('<div class="row header year" style="width: ' + tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">' + year + '</div></div>');

					// Last month
					monthArr.push('<div class="row header month" style="width: ' + tools.getCellSize() * daysInMonth + 'px">"<div class="fn-label">' + settings.months[month] + '</div></div>');

					var dataPanel = core.dataPanel(element, range.length * tools.getCellSize());

					// Append panel elements
					dataPanel.append(yearArr.join(""));
					dataPanel.append(monthArr.join(""));
					dataPanel.append($('<div class="row"/>').html(dayArr.join("")));
					dataPanel.append($('<div class="row"/>').html(dowArr.join("")));

					break;

				// **Days (default)**
				default:
					range = tools.parseDateRange(settings.dateStart, settings.dateEnd);

					var year = range[0].getFullYear();
					var month = range[0].getMonth();
					var day = range[0];

					for (var i = 0; i < range.length; i++) {
						var rday = range[i];

						// Fill years
						if (rday.getFullYear() !== year) {
							yearArr.push(('<div class="row header year" style="width:' + tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">' + year + '</div></div>'));
							year = rday.getFullYear();
							daysInYear = 0;
						}
						daysInYear++;

						// Fill months
						if (rday.getMonth() !== month) {
							monthArr.push(('<div class="row header month" style="width:' + tools.getCellSize() * daysInMonth + 'px;"><div class="fn-label">' + settings.months[month] + '</div></div>'));
							month = rday.getMonth();
							daysInMonth = 0;
						}
						daysInMonth++;

						var getDay = rday.getDay();
						var day_class = dowClass[getDay];
						if (holidays.indexOf((new Date(rday.getFullYear(), rday.getMonth(), rday.getDate())).getTime()) > -1) {
							day_class = "holiday";
						}

						dayArr.push('<div class="row date ' + day_class + '" ' + ' id="dh-' + tools.genId(settings.scale, rday.getTime()) + '" offset="' + i * tools.getCellSize() + '" repdate="' + rday.genRepDate(settings.scale) + '> ' + ' <div class="fn-label">' + rday.getDate() + '</div></div>');
						dowArr.push('<div class="row day ' + day_class + '" ' + ' id="dw-' + tools.genId(settings.scale, rday.getTime()) + '"  repdate="' + rday.genRepDate(settings.scale) + '"> ' + ' <div class="fn-label">' + settings.dow[getDay] + '</div></div>');
					}//for

					// Last year
					yearArr.push('<div class="row header year" style="width: ' + tools.getCellSize() * daysInYear + 'px;"><div class="fn-label">' + year + '</div></div>');

					// Last month
					monthArr.push('<div class="row header month" style="width: ' + tools.getCellSize() * daysInMonth + 'px"><div class="fn-label">' + settings.months[month] + '</div></div>');

					var dataPanel = core.dataPanel(element, range.length * tools.getCellSize());

					// Append panel elements

					dataPanel.append(yearArr.join(""));
					dataPanel.append(monthArr.join(""));
					dataPanel.append($('<div class="row"/>').html(dayArr.join("")));
					dataPanel.append($('<div class="row"/>').html(dowArr.join("")));

					break;
			}

			return $('<div class="rightPanel"></div>').append(dataPanel);
		},

		// **Navigation**
		navigation : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);
			var ganttNavigate = null;
			// Scrolling navigation is provided by setting
			// `settings.navigate='scroll'`
			if (settings.navigate === "scroll") {
				ganttNavigate = $('<div class="navigate" />').append($('<div class="nav-slider" />').append($('<div class="nav-slider-left" />').append($('<span role="button" class="nav-link nav-page-back"/>').html('&lt;').click(function() {
					core.navigatePage(element, -1);
				})).append($('<div class="page-number"/>').append($('<span/>').html(settings.pageNum + 1 + ' of ' + settings.pageCount))).append($('<span role="button" class="nav-link nav-page-next"/>').html('&gt;').click(function() {
					core.navigatePage(element, 1);
				})).append($('<span role="button" class="nav-link nav-now"/>').html('&#9679;').click(function() {
					core.navigateTo(element, 'now');
				})).append($('<span role="button" class="nav-link nav-prev-week"/>').html('&lt;&lt;').click(function() {
					if (settings.scale === 'hours') {
						core.navigateTo(element, tools.getCellSize() * 8);
					} else if (settings.scale === 'days') {
						core.navigateTo(element, tools.getCellSize() * 30);
					} else if (settings.scale === 'weeks') {
						core.navigateTo(element, tools.getCellSize() * 12);
					} else if (settings.scale === 'months') {
						core.navigateTo(element, tools.getCellSize() * 6);
					}
				})).append($('<span role="button" class="nav-link nav-prev-day"/>').html('&lt;').click(function() {
					if (settings.scale === 'hours') {
						core.navigateTo(element, tools.getCellSize() * 4);
					} else if (settings.scale === 'days') {
						core.navigateTo(element, tools.getCellSize() * 7);
					} else if (settings.scale === 'weeks') {
						core.navigateTo(element, tools.getCellSize() * 4);
					} else if (settings.scale === 'months') {
						core.navigateTo(element, tools.getCellSize() * 3);
					}
				}))).append($('<div class="nav-slider-content" />').append($('<div class="nav-slider-bar" />').append($('<a class="nav-slider-button" />')).mousedown(function(e) {
					if (e.preventDefault) {
						e.preventDefault();
					}
					settings.scrollNavigation.scrollerMouseDown = true;
					core.sliderScroll(element, e);
				}).mousemove(function(e) {
					if (settings.scrollNavigation.scrollerMouseDown) {
						core.sliderScroll(element, e);
					}
				}))).append($('<div class="nav-slider-right" />').append($('<span role="button" class="nav-link nav-next-day"/>').html('&gt;').click(function() {
					if (settings.scale === 'hours') {
						core.navigateTo(element, tools.getCellSize() * -4);
					} else if (settings.scale === 'days') {
						core.navigateTo(element, tools.getCellSize() * -7);
					} else if (settings.scale === 'weeks') {
						core.navigateTo(element, tools.getCellSize() * -4);
					} else if (settings.scale === 'months') {
						core.navigateTo(element, tools.getCellSize() * -3);
					}
				})).append($('<span role="button" class="nav-link nav-next-week"/>').html('&gt;&gt;').click(function() {
					if (settings.scale === 'hours') {
						core.navigateTo(element, tools.getCellSize() * -8);
					} else if (settings.scale === 'days') {
						core.navigateTo(element, tools.getCellSize() * -30);
					} else if (settings.scale === 'weeks') {
						core.navigateTo(element, tools.getCellSize() * -12);
					} else if (settings.scale === 'months') {
						core.navigateTo(element, tools.getCellSize() * -6);
					}
				})).append($('<span role="button" class="nav-link nav-zoomIn"/>').html('&#43;').click(function() {
					core.zoomInOut(element, -1);
				})).append($('<span role="button" class="nav-link nav-zoomOut"/>').html('&#45;').click(function() {
					core.zoomInOut(element, 1);
				}))));
				$(document).mouseup(function() {
					settings.scrollNavigation.scrollerMouseDown = false;
				});
				// Button navigation is provided by setting `settings.navigation='buttons'`
			} else {
				ganttNavigate = $('<div class="navigate" />').append($('<span role="button" class="nav-link nav-page-back"/>').html('&lt;').click(function() {
					core.navigatePage(element, -1);
				})).append($('<div class="page-number"/>').append($('<span/>').html(settings.pageNum + 1 + ' of ' + settings.pageCount))).append($('<span role="button" class="nav-link nav-page-next"/>').html('&gt;').click(function() {
					core.navigatePage(element, 1);
				})).append($('<span role="button" class="nav-link nav-begin"/>').html('&#124;&lt;').click(function() {
					core.navigateTo(element, 'begin');
				})).append($('<span role="button" class="nav-link nav-prev-week"/>').html('&lt;&lt;').click(function() {
					core.navigateTo(element, tools.getCellSize() * 7);
				})).append($('<span role="button" class="nav-link nav-prev-day"/>').html('&lt;').click(function() {
					core.navigateTo(element, tools.getCellSize());
				})).append($('<span role="button" class="nav-link nav-now"/>').html('&#9679;').click(function() {
					core.navigateTo(element, 'now');
				})).append($('<span role="button" class="nav-link nav-next-day"/>').html('&gt;').click(function() {
					core.navigateTo(element, tools.getCellSize() * -1);
				})).append($('<span role="button" class="nav-link nav-next-week"/>').html('&gt;&gt;').click(function() {
					core.navigateTo(element, tools.getCellSize() * -7);
				})).append($('<span role="button" class="nav-link nav-end"/>').html('&gt;&#124;').click(function() {
					core.navigateTo(element, 'end');
				})).append($('<span role="button" class="nav-link nav-zoomIn"/>').html('&#43;').click(function() {
					core.zoomInOut(element, -1);
				})).append($('<span role="button" class="nav-link nav-zoomOut"/>').html('&#45;').click(function() {
					core.zoomInOut(element, 1);
				}));
			}
			return $('<div class="bottom"/>').append(ganttNavigate);
		},

		// **Progress Bar**
		// Return an element representing a progress of position within
		// the entire chart
		createProgressBar : function(days, cls, desc, label, dataObj) {
			var $this = $(this);
			var settings = $this.data(pname);
			var cellWidth = tools.getCellSize();
			var barMarg = tools.getProgressBarMargin() || 0;
			var bar = $('<div class="bar"><div class="fn-label">' + label + '</div></div>').addClass(cls).css({
				width : ((cellWidth * days) - barMarg) + 5
			}).data("dataObj", dataObj);

			if (desc) {
				bar.mouseover(function(e) {
					var hint = $('<div class="fn-gantt-hint" />').html(desc);
					$("body").append(hint);
					hint.css("left", e.pageX);
					hint.css("top", e.pageY);
					hint.show();
				}).mouseout(function() {
					$(".fn-gantt-hint").remove();
				}).mousemove(function(e) {
					$(".fn-gantt-hint").css("left", e.pageX);
					$(".fn-gantt-hint").css("top", e.pageY + 15);
				});
			}
			/*bar.click(function(e) {
			 e.stopPropagation();
			 settings.onItemClick($(this).data("dataObj"));
			 });*/
			return bar;
		},

		// Remove the `wd` (weekday) class and add `today` class to the
		// current day/week/month (depending on the current scale)
		markNow : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);
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

		// **Fill the Chart**
		// Parse the data and fill the data panel
		fillData : function(element, datapanel, leftpanel) {
			var $this = $(element);
			var settings = $this.data(pname);
			var invertColor = function(colStr) {
				try {
					colStr = colStr.replace("rgb(", "").replace(")", "");
					var rgbArr = colStr.split(",");
					var R = parseInt(rgbArr[0], 10);
					var G = parseInt(rgbArr[1], 10);
					var B = parseInt(rgbArr[2], 10);
					var gray = Math.round((255 - (0.299 * R + 0.587 * G + 0.114 * B)) * 0.9, 1);
					return "rgb(" + gray + ", " + gray + ", " + gray + ")";
				} catch (err) {
					return "";
				}
			};
			// Loop through the values of each data element and set a row
			$.each(settings.data, function(i, entry) {
				if (i >= settings.pageNum * settings.itemsPerPage && i < (settings.pageNum * settings.itemsPerPage + settings.itemsPerPage)) {

					$.each(entry.values, function(j, day) {
						var _bar = null;

						switch (settings.scale) {
							// **Hourly data**
							case "hours":
								var dFrom = tools.genId(settings.scale, tools.dateDeserialize(day.from).getTime(), settings.scaleStep);
								var from = $(element).find('#dh-' + dFrom);

								var dTo = tools.genId(settings.scale, tools.dateDeserialize(day.to).getTime(), settings.scaleStep);
								var to = $(element).find('#dh-' + dTo);

								var cFrom = from.attr("offset");
								var cTo = to.attr("offset");
								var dl = Math.floor((cTo - cFrom) / tools.getCellSize()) + 1;

								_bar = core.createProgressBar(dl, day.customClass ? day.customClass : "", day.desc ? day.desc : "", day.label ? day.label : "", day.dataObj ? day.dataObj : null);
								_bar.click(function(e) {
									e.stopPropagation();
									settings.onItemClick($(element).data("dataObj"));
								});

								// find row
								var topEl = $(element).find("#rowheader" + i);

								var top = tools.getCellSize() * 5 + 2 + parseInt(topEl.attr("offset"), 10);
								_bar.css({
									'margin-top' : top,
									'margin-left' : Math.floor(cFrom)
								});

								datapanel.append(_bar);
								break;

							// **Weekly data**
							case "weeks":
								var dtFrom = tools.dateDeserialize(day.from);
								var dtTo = tools.dateDeserialize(day.to);

								if (dtFrom.getDate() <= 3 && dtFrom.getMonth() === 0) {
									dtFrom.setDate(dtFrom.getDate() + 4);
								}

								if (dtFrom.getDate() <= 3 && dtFrom.getMonth() === 0) {
									dtFrom.setDate(dtFrom.getDate() + 4);
								}

								if (dtTo.getDate() <= 3 && dtTo.getMonth() === 0) {
									dtTo.setDate(dtTo.getDate() + 4);
								}

								var from = $(element).find("#" + dtFrom.getWeekId());

								var cFrom = from.attr("offset");

								var to = $(element).find("#" + dtTo.getWeekId());
								var cTo = to.attr("offset");

								var dl = Math.round((cTo - cFrom) / tools.getCellSize()) + 1;

								_bar = core.createProgressBar(dl, day.customClass ? day.customClass : "", day.desc ? day.desc : "", day.label ? day.label : "", day.dataObj ? day.dataObj : null);
								_bar.click(function(e) {
									e.stopPropagation();
									settings.onItemClick($(element).data("dataObj"));
								});

								// find row
								var topEl = $(element).find("#rowheader" + i);

								var top = tools.getCellSize() * 3 + 2 + parseInt(topEl.attr("offset"), 10);
								_bar.css({
									'margin-top' : top,
									'margin-left' : Math.floor(cFrom)
								});

								datapanel.append(_bar);
								break;

							// **Monthly data**
							case "months":
								var dtFrom = tools.dateDeserialize(day.from);
								var dtTo = tools.dateDeserialize(day.to);

								if (dtFrom.getDate() <= 3 && dtFrom.getMonth() === 0) {
									dtFrom.setDate(dtFrom.getDate() + 4);
								}

								if (dtFrom.getDate() <= 3 && dtFrom.getMonth() === 0) {
									dtFrom.setDate(dtFrom.getDate() + 4);
								}

								if (dtTo.getDate() <= 3 && dtTo.getMonth() === 0) {
									dtTo.setDate(dtTo.getDate() + 4);
								}

								var from = $(element).find("#dh-" + tools.genId(settings.scale, dtFrom.getTime()));
								var cFrom = from.attr("offset");
								var to = $(element).find("#dh-" + tools.genId(settings.scale, dtTo.getTime()));
								var cTo = to.attr("offset");
								var dl = Math.round((cTo - cFrom) / tools.getCellSize()) + 1;

								_bar = core.createProgressBar(dl, day.customClass ? day.customClass : "", day.desc ? day.desc : "", day.label ? day.label : "", day.dataObj ? day.dataObj : null);
								_bar.click(function(e) {
									e.stopPropagation();
									settings.onItemClick($(element).data("dataObj"));
								});

								// find row
								var topEl = $(element).find("#rowheader" + i);

								var top = tools.getCellSize() * 2 + 2 + parseInt(topEl.attr("offset"), 10);
								_bar.css({
									'margin-top' : top,
									'margin-left' : Math.floor(cFrom)
								});

								datapanel.append(_bar);
								break;

							// **Days**
							default:
								var dFrom = tools.genId(settings.scale, tools.dateDeserialize(day.from).getTime());
								var dTo = tools.genId(settings.scale, tools.dateDeserialize(day.to).getTime());

								var from = $(element).find("#dh-" + dFrom);
								var cFrom = from.attr("offset");

								var dl = Math.floor(((dTo / 1000) - (dFrom / 1000)) / 86400) + 1;
								_bar = core.createProgressBar(dl, day.customClass ? day.customClass : "", day.desc ? day.desc : "", day.label ? day.label : "", day.dataObj ? day.dataObj : null);
								_bar.click(function(e) {
									e.stopPropagation();
									settings.onItemClick($(element).data("dataObj"));
								});

								// find row
								var topEl = $(element).find("#rowheader" + i);

								var top = tools.getCellSize() * 4 + 2 + parseInt(topEl.attr("offset"), 10);
								_bar.css({
									'margin-top' : top,
									'margin-left' : Math.floor(cFrom)
								});

								datapanel.append(_bar);

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
		// **Navigation**
		navigateTo : function(element, val) {
			var $this = $(element);
			var $rightPanel = $(element).find(".fn-gantt .rightPanel");
			var $dataPanel = $rightPanel.find(".dataPanel");
			$dataPanel.click = function() {
				alert(arguments.join(""));
			};
			var rightPanelWidth = $rightPanel.width();
			var dataPanelWidth = $dataPanel.width();

			switch (val) {
				case "begin":
					$dataPanel.animate({
						"margin-left" : "0px"
					}, "fast", function() {
						core.repositionLabel(element);
					});
					settings.scrollNavigation.panelMargin = 0;
					break;
				case "end":
					var mLeft = dataPanelWidth - rightPanelWidth;
					settings.scrollNavigation.panelMargin = mLeft * -1;
					$dataPanel.animate({
						"margin-left" : "-" + mLeft + "px"
					}, "fast", function() {
						core.repositionLabel(element);
					});
					break;
				case "now":
					if (!settings.scrollNavigation.canScroll || !$dataPanel.find(".today").length) {
						return false;
					}
					var max_left = (dataPanelWidth - rightPanelWidth) * -1;
					var cur_marg = $dataPanel.css("margin-left").replace("px", "");
					var val = $dataPanel.find(".today").offset().left - $dataPanel.offset().left;
					val *= -1;
					if (val > 0) {
						val = 0;
					} else if (val < max_left) {
						val = max_left;
					}
					$dataPanel.animate({
						"margin-left" : val + "px"
					}, "fast", core.repositionLabel(element));
					settings.scrollNavigation.panelMargin = val;
					break;
				default:
					var max_left = (dataPanelWidth - rightPanelWidth) * -1;
					var cur_marg = $dataPanel.css("margin-left").replace("px", "");
					var val = parseInt(cur_marg, 10) + val;
					if (val <= 0 && val >= max_left) {
						$dataPanel.animate({
							"margin-left" : val + "px"
						}, "fast", core.repositionLabel(element));
					}
					settings.scrollNavigation.panelMargin = val;
					break;
			}
		},

		// Navigate to a specific page
		navigatePage : function(element, val) {
			var $this = $(element);
			var settings = $this.data(pname);

			if ((settings.pageNum + val) >= 0 && (settings.pageNum + val) < Math.ceil(settings.rowsNum / settings.itemsPerPage)) {
				core.waitToggle(element, true, function() {
					settings.pageNum += val;
					settings.hPosition = $(".fn-gantt .dataPanel").css("margin-left").replace("px", "");
					settings.scaleOldWidth = false;
					core.init(element);
				});
			}
		},

		// Change zoom level
		zoomInOut : function(element, val) {
			var $this = $(element);
			var settings = $this.data(pname);
			core.waitToggle(element, true, function() {

				var zoomIn = (val < 0);

				var scaleSt = settings.scaleStep + val * 3;
				scaleSt = scaleSt <= 1 ? 1 : scaleSt === 4 ? 3 : scaleSt;
				var scale = settings.scale;
				var headerRows = settings.headerRows;
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

				if ((zoomIn && $.inArray(scale, scales) < $.inArray(settings.minScale, scales)) || (!zoomIn && $.inArray(scale, scales) > $.inArray(settings.maxScale, scales))) {
					core.init(element);
					return;
				}
				settings.scaleStep = scaleSt;
				settings.scale = scale;
				settings.headerRows = headerRows;
				var $rightPanel = $(element).find(".fn-gantt .rightPanel");
				var $dataPanel = $rightPanel.find(".dataPanel");
				settings.hPosition = $dataPanel.css("margin-left").replace("px", "");
				settings.scaleOldWidth = ($dataPanel.width() - $rightPanel.width());

				if (settings.useCookie) {
					$.cookie(cookieKey + "CurrentScale", settings.scale);
					// reset scrollPos
					$.cookie(cookieKey + "ScrollPos", null);
				}
				core.init(element);
			});
		},

		// Move chart via mouseclick
		mouseScroll : function(element, e) {
			var $this = $(element);
			var $dataPanel = $(element).find(".fn-gantt .dataPanel");
			$dataPanel.css("cursor", "move");
			var bPos = $dataPanel.offset();
			var mPos = settings.scrollNavigation.mouseX === null ? e.pageX : settings.scrollNavigation.mouseX;
			var delta = e.pageX - mPos;
			settings.scrollNavigation.mouseX = e.pageX;

			core.scrollPanel(element, delta);

			clearTimeout(settings.scrollNavigation.repositionDelay);
			settings.scrollNavigation.repositionDelay = setTimeout(core.repositionLabel, 50, element);
		},

		// Move chart via mousewheel
		wheelScroll : function(element, e) {
			var $this = $(element);
			var settings = $this.data(pname);
			var delta = e.detail ? e.detail * (-50) : e.wheelDelta / 120 * 50;

			core.scrollPanel(element, delta);

			clearTimeout(settings.scrollNavigation.repositionDelay);
			settings.scrollNavigation.repositionDelay = setTimeout(core.repositionLabel, 50, element);

			if (e.preventDefault) {
				e.preventDefault();
			} else {
				return false;
			}
		},

		// Move chart via slider control
		sliderScroll : function(element, e) {
			var $this = $(element);
			var settings = $this.data(pname);
			var $sliderBar = $(element).find(".nav-slider-bar");
			var $sliderBarBtn = $sliderBar.find(".nav-slider-button");
			var $rightPanel = $(element).find(".fn-gantt .rightPanel");
			var $dataPanel = $rightPanel.find(".dataPanel");

			var bPos = $sliderBar.offset();
			var bWidth = $sliderBar.width();
			var wButton = $sliderBarBtn.width();

			var pos, mLeft;

			if ((e.pageX >= bPos.left) && (e.pageX <= bPos.left + bWidth)) {
				pos = e.pageX - bPos.left;
				pos = pos - wButton / 2;
				$sliderBarBtn.css("left", pos);

				mLeft = $dataPanel.width() - $rightPanel.width();

				var pPos = pos * mLeft / bWidth * -1;
				if (pPos >= 0) {
					$dataPanel.css("margin-left", "0px");
					settings.scrollNavigation.panelMargin = 0;
				} else if (pos >= bWidth - (wButton * 1)) {
					$dataPanel.css("margin-left", mLeft * -1 + "px");
					settings.scrollNavigation.panelMargin = mLeft * -1;
				} else {
					$dataPanel.css("margin-left", pPos + "px");
					settings.scrollNavigation.panelMargin = pPos;
				}
				clearTimeout(settings.scrollNavigation.repositionDelay);
				settings.scrollNavigation.repositionDelay = setTimeout(core.repositionLabel, 5, element);
			}
		},

		// Update scroll panel margins
		scrollPanel : function(element, delta) {
			var $this = $(element);
			var settings = $this.data(pname);

			if (!settings.scrollNavigation.canScroll) {
				return false;
			}
			var _panelMargin = parseInt(settings.scrollNavigation.panelMargin, 10) + delta;
			if (_panelMargin > 0) {
				settings.scrollNavigation.panelMargin = 0;
				$(element).find(".fn-gantt .dataPanel").css("margin-left", settings.scrollNavigation.panelMargin + "px");
			} else if (_panelMargin < settings.scrollNavigation.panelMaxPos * -1) {
				settings.scrollNavigation.panelMargin = settings.scrollNavigation.panelMaxPos * -1;
				$(element).find(".fn-gantt .dataPanel").css("margin-left", settings.scrollNavigation.panelMargin + "px");
			} else {
				settings.scrollNavigation.panelMargin = _panelMargin;
				$(element).find(".fn-gantt .dataPanel").css("margin-left", settings.scrollNavigation.panelMargin + "px");
			}
			core.synchronizeScroller(element);
		},

		// Synchronize scroller
		synchronizeScroller : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);
			if (settings.navigate === "scroll") {
				var $rightPanel = $(element).find(".fn-gantt .rightPanel");
				var $dataPanel = $rightPanel.find(".dataPanel");
				var $sliderBar = $(element).find(".nav-slider-bar");
				var $sliderBtn = $sliderBar.find(".nav-slider-button");

				var bWidth = $sliderBar.width();
				var wButton = $sliderBtn.width();

				var mLeft = $dataPanel.width() - $rightPanel.width();
				var hPos = 0;
				if ($dataPanel.css("margin-left")) {
					hPos = $dataPanel.css("margin-left").replace("px", "");
				}
				var pos = hPos * bWidth / mLeft - $sliderBtn.width() * 0.25;
				pos = pos > 0 ? 0 : (pos * -1 >= bWidth - (wButton * 0.75)) ? (bWidth - (wButton * 1.25)) * -1 : pos;
				$sliderBtn.css("left", pos * -1);
			}
		},

		// Reposition data labels
		repositionLabel : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);
			setTimeout(function() {
				var $dataPanel;
				if (!element) {
					$dataPanel = $(".fn-gantt .rightPanel .dataPanel");
				} else {
					var $rightPanel = $(element).find(".fn-gantt .rightPanel");
					$dataPanel = $rightPanel.find(".dataPanel");
				}

				if (settings.useCookie) {
					$.cookie(cookieKey + "ScrollPos", $dataPanel.css("margin-left").replace("px", ""));
				}
			}, 500);
		},

		// waitToggle
		waitToggle : function(element, show, fn) {
			var $this = $(element);
			var settings = $this.data(pname);
			if (show) {
				var eo = $(element).offset();
				var ew = $(element).outerWidth();
				var eh = $(element).outerHeight();

				if (!settings.loader) {
					settings.loader = $('<div class="fn-gantt-loader" style="position: absolute; top: ' + eo.top + 'px; left: ' + eo.left + 'px; width: ' + ew + 'px; height: ' + eh + 'px;">' + '<div class="fn-gantt-loader-spinner"><span>' + settings.waitText + '</span></div></div>');
				}
				$("body").append(settings.loader);
				setTimeout(fn, 100);

			} else {
				if (settings.loader) {
					settings.loader.remove();
				}
				settings.loader = null;
			}
		}
	};

	// Utility functions
	// =================
	var tools = {

		//Returns the maximum available data given a Date object scaled according to the actual scale
		getScaledMaxDate : function(element, date) {
			var $this = $(element);
			var settings = $this.data(pname);
			var maxDate = date;
			switch (settings.scale) {
				case "hours":
					maxDate.setHours(Math.ceil((maxDate.getHours()) / settings.scaleStep) * settings.scaleStep);
					maxDate.setHours(maxDate.getHours() + settings.scaleStep * 3);
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

		//Returns the minimum available data given a Date object scaled according to the actual scale
		getScaledMinDate : function(element, date) {
			var $this = $(element);
			var settings = $this.data(pname);
			var minDate = date;
			switch (settings.scale) {
				case "hours":
					minDate.setHours(Math.floor((minDate.getHours()) / settings.scaleStep) * settings.scaleStep);
					minDate.setHours(minDate.getHours() - settings.scaleStep * 3);
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
					break;
			}
			return minDate;
		},

		// Return the maximum available date in data depending on the scale
		getMaxDate : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);
			var maxDate = null;
			$.each(settings.data, function(i, entry) {
				$.each(entry.values, function(i, date) {
					maxDate = maxDate < tools.dateDeserialize(date.to) ? tools.dateDeserialize(date.to) : maxDate;
				});
			});

			return this.getScaledMaxDate(element, maxDate);
		},

		// Return the minimum available date in data depending on the scale
		getMinDate : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);
			var minDate = null;
			$.each(settings.data, function(i, entry) {
				$.each(entry.values, function(i, date) {
					minDate = minDate > tools.dateDeserialize(date.from) || minDate === null ? tools.dateDeserialize(date.from) : minDate;
				});
			});
			return this.getScaledMinDate(element, minDate);
		},

		// Return an array of Date objects between `from` and `to`
		parseDateRange : function(from, to) {
			var current = new Date(from.getTime());
			var end = new Date(to.getTime());
			var ret = [];
			var i = 0;
			do {
				ret[i++] = new Date(current.getTime());
				current.setDate(current.getDate() + 1);
			} while (current.getTime() <= to.getTime());
			return ret;

		},

		// Return an array of Date objects between `from` and `to`,
		// scaled hourly
		parseTimeRange : function(from, to, scaleStep) {
			var current = new Date(from);
			var end = new Date(to);
			var ret = [];
			var i = 0;
			do {
				ret[i] = new Date(current.getTime());
				current.setHours(current.getHours() + scaleStep);
				current.setHours(Math.floor((current.getHours()) / scaleStep) * scaleStep);

				if (current.getDay() !== ret[i].getDay()) {
					current.setHours(0);
				}

				i++;
			} while (current.getTime() <= to.getTime());
			return ret;
		},

		// Return an array of Date objects between a range of weeks
		// between `from` and `to`
		parseWeeksRange : function(from, to) {

			var current = new Date(from);
			var end = new Date(to);

			var ret = [];
			var i = 0;

			do {
				if (current.getDay() === 0) {
					ret[i++] = current.getDayForWeek();
				}
				current.setDate(current.getDate() + 1);
			} while (current.getTime() <= to.getTime());

			return ret;
		},

		// Return an array of Date objects between a range of months
		// between `from` and `to`
		parseMonthsRange : function(from, to) {

			var current = new Date(from);
			var end = new Date(to);

			var ret = [];
			var i = 0;
			do {
				ret[i++] = new Date(current.getFullYear(), current.getMonth(), 1);
				current.setMonth(current.getMonth() + 1);
			} while (current.getTime() <= to.getTime());

			return ret;
		},

		// Deserialize a date from a string
		dateDeserialize : function(dateStr) {
			//return eval("new" + dateStr.replace(/\//g, " "));
			var date = eval("new" + dateStr.replace(/\//g, " "));
			return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes());
		},

		// Generate an id for a date
		genId : function(scale, ticks) {
			var t = new Date(ticks);
			switch (scale) {
				case "hours":
					var hour = t.getHours();
					if (arguments.length >= 2) {
						hour = (Math.floor((t.getHours()) / arguments[1]) * arguments[1]);
					}
					return (new Date(t.getFullYear(), t.getMonth(), t.getDate(), hour)).getTime();
				case "weeks":
					var y = t.getFullYear();
					var w = t.getDayForWeek().getWeekOfYear();
					var m = t.getMonth();
					if (m === 11 && w === 1) {
						y++;
					}
					return y + "-" + w;
				case "months":
					return t.getFullYear() + "-" + t.getMonth();
				default:
					return (new Date(t.getFullYear(), t.getMonth(), t.getDate())).getTime();
			}
		},

		// Get the current cell size
		_getCellSize : null,
		getCellSize : function() {
			if (!tools._getCellSize) {
				$("body").append($('<div style="display: none; position: absolute;" class="fn-gantt" id="measureCellWidth"><div class="row"></div></div>'));
				tools._getCellSize = $("#measureCellWidth .row").height();
				$("#measureCellWidth").empty().remove();
			}
			return tools._getCellSize;
		},

		// Get the current size of the rigth panel
		getRightPanelSize : function() {
			$("body").append($('<div style="display: none; position: absolute;" class="fn-gantt" id="measureCellWidth"><div class="rightPanel"></div></div>'));
			var ret = $("#measureCellWidth .rightPanel").height();
			$("#measureCellWidth").empty().remove();
			return ret;
		},

		// Get the current page height
		getPageHeight : function(element) {
			var $this = $(element);
			var settings = $this.data(pname);
			return settings.pageNum + 1 === settings.pageCount ? settings.rowsOnLastPage * tools.getCellSize() : settings.itemsPerPage * tools.getCellSize();
		},

		// Get the current margin size of the progress bar
		_getProgressBarMargin : null,
		getProgressBarMargin : function() {
			if (!tools._getProgressBarMargin) {
				$("body").append($('<div style="display: none; position: absolute;" id="measureBarWidth" ><div class="fn-gantt"><div class="rightPanel"><div class="dataPanel"><div class="row day"><div class="bar" /></div></div></div></div></div>'));
				tools._getProgressBarMargin = parseInt($("#measureBarWidth .fn-gantt .rightPanel .day .bar").css("margin-left").replace("px", ""), 10);
				tools._getProgressBarMargin += parseInt($("#measureBarWidth .fn-gantt .rightPanel .day .bar").css("margin-right").replace("px", ""), 10);
				$("#measureBarWidth").empty().remove();
			}
			return tools._getProgressBarMargin;
		}
	};

	// custom selector `:findday` used to match on specified day in ms.
	//
	// The selector is passed a date in ms and elements are added to the
	// selection filter if the element date matches, as determined by the
	// id attribute containing a parsable date in ms.
	$.extend($.expr[":"], {
		findday : function(a, i, m) {
			var cd = new Date(parseInt(m[3], 10));
			var id = $(a).attr("id");
			id = id ? id : "";
			var si = id.indexOf("-") + 1;
			var ed = new Date(parseInt(id.substring(si, id.length), 10));
			cd = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate());
			ed = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
			return cd.getTime() === ed.getTime();
		}
	});
	// custom selector `:findweek` used to match on specified week in ms.
	$.extend($.expr[":"], {
		findweek : function(a, i, m) {
			var cd = new Date(parseInt(m[3], 10));
			var id = $(a).attr("id");
			id = id ? id : "";
			var si = id.indexOf("-") + 1;
			cd = cd.getFullYear() + "-" + cd.getDayForWeek().getWeekOfYear();
			var ed = id.substring(si, id.length);
			return cd === ed;
		}
	});
	// custom selector `:findmonth` used to match on specified month in ms.
	$.extend($.expr[":"], {
		findmonth : function(a, i, m) {
			var cd = new Date(parseInt(m[3], 10));
			cd = cd.getFullYear() + "-" + cd.getMonth();
			var id = $(a).attr("id");
			id = id ? id : "";
			var si = id.indexOf("-") + 1;
			var ed = id.substring(si, id.length);
			return cd === ed;
		}
	});

	// Date prototype helpers
	// ======================

	// `getWeekId` returns a string in the form of 'dh-YYYY-WW', where WW is
	// the week # for the year.
	// It is used to add an id to the week divs
	Date.prototype.getWeekId = function() {
		var y = this.getFullYear();
		var w = this.getDayForWeek().getWeekOfYear();
		var m = this.getMonth();
		if (m === 11 && w === 1) {
			y++;
		}
		return 'dh-' + y + "-" + w;
	};

	// `getRepDate` returns the seconds since the epoch for a given date
	// depending on the active scale
	Date.prototype.genRepDate = function(scale) {
		switch (scale) {
			case "hours":
				return this.getTime();
			case "weeks":
				return this.getDayForWeek().getTime();
			case "months":
				return new Date(this.getFullYear(), this.getMonth(), 1).getTime();
			default:
				return this.getTime();
		}
	};

	// `getDayOfYear` returns the day number for the year
	Date.prototype.getDayOfYear = function() {
		var fd = new Date(this.getFullYear(), 0, 0);
		var sd = new Date(this.getFullYear(), this.getMonth(), this.getDate());
		return Math.ceil((sd - fd) / 86400000);
	};

	// `getWeekOfYear` returns the week number for the year
	Date.prototype.getWeekOfYear = function() {
		var ys = new Date(this.getFullYear(), 0, 1);
		var sd = new Date(this.getFullYear(), this.getMonth(), this.getDate());
		if (ys.getDay() > 3) {
			ys = new Date(sd.getFullYear(), 0, (7 - ys.getDay()));
		}
		var daysCount = sd.getDayOfYear() - ys.getDayOfYear();
		return Math.ceil(daysCount / 7);

	};

	// `getDaysInMonth` returns the number of days in a month
	Date.prototype.getDaysInMonth = function() {
		return 32 - new Date(this.getFullYear(), this.getMonth(), 32).getDate();
	};

	// `hasWeek` returns `true` if the date resides on a week boundary
	// **????????????????? Don't know if this is true**
	Date.prototype.hasWeek = function() {
		var df = new Date(this.valueOf());
		df.setDate(df.getDate() - df.getDay());
		var dt = new Date(this.valueOf());
		dt.setDate(dt.getDate() + (6 - dt.getDay()));

		if (df.getMonth() === dt.getMonth()) {
			return true;
		} else {
			return (df.getMonth() === this.getMonth() && dt.getDate() < 4) || (df.getMonth() !== this.getMonth() && dt.getDate() >= 4);
		}
	};

	// `getDayForWeek` returns the Date object for the starting date of
	// the week # for the year
	Date.prototype.getDayForWeek = function() {
		var df = new Date(this.valueOf());
		df.setDate(df.getDate() - df.getDay());
		var dt = new Date(this.valueOf());
		dt.setDate(dt.getDate() + (6 - dt.getDay()));
		if ((df.getMonth() === dt.getMonth()) || (df.getMonth() !== dt.getMonth() && dt.getDate() >= 4)) {
			return new Date(dt.setDate(dt.getDate() - 3));
		} else {
			return new Date(df.setDate(df.getDate() + 3));
		}
	};

	$.fn.gantt = function() {

		var method = arguments[0];

		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if ( typeof method === 'object' || !method) {
			return methods.init.apply(this, arguments);
		} else {
			$.error('Method ' + method + ' does not exist on jQuery.tooltip');
			return this;
		}

	};
})(jQuery);
