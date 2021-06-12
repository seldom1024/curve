/**
 * @file response
 * @author cuiyuan
 */

import './trend.less';
import './MFTable.less';

import React, {Component} from 'react';
import {hashHistory} from 'react-router';
import {axiosInstance} from '../../tools/axiosInstance';
import eventProxy from '../../tools/eventProxy';
import Chart from '../../common/baseComponent/chart';
import UploadData from '../../common/baseComponent/uploadData';
import img from '../../common/image/background-image.png';
import moment from 'moment';
import $ from 'jquery';
import Band from '../../common/baseComponent/band';

const api = require('../../common/api').default.api;

window.selectedIndex = {};
window.labelObj = {};
window.thumbExtremes = {};

let key = {
    keyMap: {a: 65, d: 68, s: 83, w: 87, z: 90, spacebar: 32},
    currentKey: null,
    mouseKey: null
};

export default class Trend extends Component {
    constructor(props) {
        super(props);

        this.state = {
            // Trend graph name
            title: '',
            // Related overview information
            summary: {},
            // Trend graph data
            data: [],
            // name of trend
            name: '',
            // Get the url of the trend graph
            url: api.getTrend,
            // menu of operation
            menuList: [],
            // The list of data on the left
            dataList: [],
            // Get the url of the thumbnail trend graph
            thumbUrl: api.getThumbTrend,
            chart: {},
            startTime: 0,
            endTime: 0,
            // All the points of the trend graph
            allSeriesPoints: [],
            list: [],
            init: true,
            container: 'container',
            options: {},
            type: 'stockChart',
            max: 0,
            min: 0,
            legend: {},
            bandMenuStyle: true,
            smallBandMenuStyle: false,
            // if trend is loading
            loading: true,
            neverReflow: false,
            datasInit: true
        };
        this.abnormalSelectedPoints = [];
        this.abnormalSelectedIndex = [];
        // The maximum value the x-axis can set when zooming in
        this.enlargeExtremesMax = undefined;
        // The minimum value that the x-axis can set when reducing the operation
        this.enlargeExtremesMin = undefined;
        this.latestMax = undefined;
        this.latestMin = undefined;
    }

    componentDidMount() {
        const self = this;
        self.renderTrend();
        self.getOperaMenuData();
        let num = 1;
        $('body').on('keydown', function (e) {
            let t = e.keyCode || e.which || e.charCode;
            let keyArr = [32, 38, 87, 40, 83, 37, 65, 39, 68];
            if (t && keyArr.indexOf(t) !== -1) {
                e.preventDefault();
            }
            e = e ? e : window.event;
            key.currentKey = e.keyCode || e.which || e.charCode;
            // self.keyOpera(e);
        });
        // Keyboard operation trend graph
        $('body').on('keyup', function (e) {
            let t = e.keyCode || e.which || e.charCode;
            let keyArr = [32, 38, 87, 40, 83, 37, 65, 39, 68];
            if (t && keyArr.indexOf(t) !== -1) {
                e.preventDefault();
            }
            e = e ? e : window.event;
            self.keyOpera(e);
            if (t === 32) {
                key.currentKey = null;
            }
        });
        // Operation menu
        $('body').delegate('.selection li', 'click', function (e) {
            e.stopPropagation();
            let action = $(this).attr('data-action');
            let startTime = 0;
            let endTime = 0;
            let currentX = parseInt($(this).attr('data-currentx'), 10);
            let name = self.props.params.name;
            let currentIndex = 0;
            // get real startTime and endTime
            for (let i = 0; i < window.labelObj[name].length; i++) {
                if (currentX >= window.labelObj[name][i][0] && currentX <= window.labelObj[name][i][1]) {
                    startTime = window.labelObj[name][i][0];
                    endTime = window.labelObj[name][i][1];
                    currentIndex = i;
                    break;
                }
            }
            let url = api.menuOpera
                + name
                + '?startTime=' + startTime
                + '&endTime=' + endTime
                + '&action=' + action;
            // get current trend graph max and min
            axiosInstance.put(url).then(function (response) {
                // update window.labelObj
                window.labelObj[name].splice(currentIndex, 1);
                self.redrawTrend(self.min, self.max);
            });
        });
        // Operation tooltip
        $('body').delegate('.area-tooltip .load-trend', 'click', function (e) {
            e.stopPropagation();
            let type = $(this).attr('data-action');
            let startTime = 0;
            let endTime = 0;
            let bandName = $(this).attr('data-band-name');
            if (type === 'left') {
                startTime = $(this).attr('data-pre-start-time');
                endTime = $(this).attr('data-pre-end-time');
            }
            else {
                startTime = $(this).attr('data-next-start-time');
                endTime = $(this).attr('data-next-end-time');
            }
            let name = self.props.params.name;
            let url = api.getTrend
                + name
                + '/curves?'
                + 'startTime=' + startTime
                + '&endTime=' + endTime
                + '&bandName=' + bandName;
            if (startTime > endTime) {
                eventProxy.trigger('openDialog', {
                    title: 'Note',
                    content: 'Error: startTime > endTime.',
                    name: '',
                    type: 'alert'
                });
                return;
            }
            self.getTrendData(url, undefined, undefined, false, true);
        });

        let TREND_LOADING = 'The trend is loading, please wait';
        // loading trend graph
        self.loadingTime = setInterval(function () {
            let text = '';
            if (num === 1) {
                text = '.';
            }
            else if (num === 2) {
                text = '..';
            }
            else if (num === 3) {
                text = '...';
                num = 0;
            }
            num++;
            if (self.props.params.list && self.props.params.list.length && self.state.loading) {
                if (self.refs.loadingContainer) {
                    self.refs.loadingContainer.innerHTML = TREND_LOADING + text;
                }
            }
        }, 800);

        // Operation  menu
        $('body').delegate('.label-opera', 'click', function (e) {
            let startTime = $(this).attr('data-current-start-time');
            let endTime = $(this).attr('data-current-end-time');
            self.label(startTime, endTime, false);
        });

        // Gets the subscript of the selected point
        // Get the selected interval
        eventProxy.on('loadedChart', chart => {
            let series = {};
            let name = self.props.params.name;
            window.labelObj[name] = [];
            chart.series.forEach(item => {
                if (item.name === 'label line') {
                    series = item;
                }
            });
            if (series.points) {
                let tempEndTime = 0;
                let tempStartTime = 0;
                for (let i = 0; i < series.points.length - 1; i++) {
                    if (!series.points[i].y && series.points[i + 1].y) {
                        tempStartTime = series.points[i + 1].x;
                    }
                    if (series.points[i].y && !series.points[i + 1].y) {
                        tempEndTime = series.points[i].x;
                    }
                    if (tempStartTime && tempEndTime) {
                        window.labelObj[name].push([tempStartTime, tempEndTime]);
                        tempStartTime = undefined;
                        tempEndTime = undefined;
                    }
                }
            }
        });

        eventProxy.on('loadTrend', obj => {
            let text = '';
            if (obj.list.length && self.state.loading) {
                // Add trend loading tips
                if (!self.refs.loadingContainer && self.refs.loadingTip) {
                    self.refs.loadingTip.style.display = 'block';
                    self.loadingTrendTipTime = setInterval(function () {
                        if (num === 1) {
                            text = '.';
                        }
                        else if (num === 2) {
                            text = '..';
                        }
                        else if (num === 3) {
                            text = '...';
                            num = 0;
                        }
                        num++;
                        if (self.refs.loadingTip) {
                            self.refs.loadingTip.innerHTML = TREND_LOADING + text;
                        }
                    }, 800);
                }
            }
        });

        eventProxy.on('loadingTip', (tip, hasNoData) => {
            let originText = tip ? tip : TREND_LOADING;
            // Add trend loading tips
            let num = 1;
            if (!self.refs.loadingContainer && self.refs.loadingTip) {
                self.refs.loadingTip.style.display = 'block';
                if (hasNoData) {
                    if (self.refs.loadingTip) {
                        self.refs.loadingTip.innerHTML = originText;
                    }
                }
                else {
                    let text = '';
                    self.loadingTipTime = setInterval(function () {
                        if (num === 1) {
                            text = originText + '.';
                        }
                        else if (num === 2) {
                            text = originText + '..';
                        }
                        else if (num === 3) {
                            text = originText + '...';
                            num = 0;
                        }
                        num++;
                        if (self.refs.loadingTip) {
                            self.refs.loadingTip.innerHTML = text;
                        }
                    }, 800);
                }
            }
        });

        eventProxy.on('bandVisible', legend => {
            this.state.bandSeries.forEach((item, index) => {
                if (!legend[item.name]) {
                    item.visible = false;
                }
                else if (legend[item.name] === 'show') {
                    item.visible = true;
                }
            });
            this.setState({
                bandSeries: this.state.bandSeries
            });
        });
    }

    keyOpera(e) {
        const self = this;
        let t = e.keyCode || e.which || e.charCode;
        let keyArr = [32, 38, 87, 40, 83, 37, 65, 39, 68];
        if (t &&  keyArr.indexOf(t) !== -1) {
            // 38, 87: enlarge
            // 40, 83: Shrink down
            // 37: Left shift
            // 39: Right shift
            let chart = self.chart;
            let axis = chart && chart.xAxis[0].getExtremes();
            let min = axis && !(Math.round(axis.min) % 1000) ? Math.round(axis.min) : self.getTime(axis.min);
            let max = axis && !(Math.round(axis.max) % 1000) ? Math.round(axis.max) : self.getTime(axis.max);
            let step = 0;
            let startTime;
            let endTime;
            let name = self.props.params.name;
            if (max - min >= 3600000) {
                step = parseInt((max - min) * 0.25, 10);
            }
            else {
                return;
            }
            let extremesMax = window.thumbExtremes[name] ? window.thumbExtremes[name].max : max;
            let extremesMin = window.thumbExtremes[name] ? window.thumbExtremes[name].min : min;
            // If there is no data and the minimum value is greater than or equal to the maximum value, the keyboard operation is no longer performed
            if (t === 38 || t === 87) {
                if (min + step < max - step) {
                    chart.xAxis[0].setExtremes(min + step, max - step, false);
                    startTime = min + step;
                    endTime = max - step;
                }
                else if (min + step >= max - step) {
                    chart.xAxis[0].setExtremes(min + step, max - step, false);
                    startTime = min + step;
                    endTime = max - step;
                }
            }
            else if (t === 40 || t === 83) {
                if (min - step >= extremesMin && max + step <= extremesMax) {
                    chart.xAxis[0].setExtremes(min - step, max + step, false);
                    startTime = min - step;
                    endTime = max + step;
                }
                else if (min - step >= extremesMin && max + step >= extremesMax) {
                    chart.xAxis[0].setExtremes(min - step, extremesMax, false);
                    startTime = min - step;
                    endTime = extremesMax;
                }
                else if (min - step <= extremesMin && max + step <= extremesMax) {
                    chart.xAxis[0].setExtremes(extremesMin, extremesMax, false);
                    startTime = extremesMin;
                    endTime = max + step;
                }
                else if (min - step <= extremesMin && max + step >= extremesMax) {
                    chart.xAxis[0].setExtremes(extremesMin, extremesMax, false);
                    startTime = extremesMin;
                    endTime = extremesMax;
                }
            }
            else if (t === 37 || t === 65) {
                if (min - step >= extremesMin) {
                    chart.xAxis[0].setExtremes(min - step, max - step, false);
                    startTime = min - step;
                    endTime = max - step;
                }
                else {
                    chart.xAxis[0].setExtremes(extremesMin, max, false);
                    startTime = extremesMin;
                    endTime = max;
                }
            }
            else if (t === 39 || t === 68) {
                if (max + step <= extremesMax) {
                    chart.xAxis[0].setExtremes(min + step, max + step, false);
                    startTime = min + step;
                    endTime = max + step;
                }
                else {
                    chart.xAxis[0].setExtremes(min, extremesMax, false);
                    startTime = min;
                    endTime = extremesMax;
                }
            }
            if (startTime && endTime && startTime <= endTime) {
                self.min = startTime;
                self.max = endTime;
                let url = api.getTrend
                    + name
                    + '/curves?'
                    + 'startTime=' + startTime
                    + '&endTime=' + endTime;
                self.getTrendData(url, undefined, undefined, false, true);
            }
            // Scroll around one screen
            // 65: prev screen
            // 68: next: next screen
        }
    }

    // redraw trend
    redrawTrend(min, max) {
        let start = min;
        let end = max;
        let name = this.props.params.name;
        let url = api.getTrend
            + name
            + '/curves?'
            + 'startTime=' + start
            + '&endTime=' + end;
        this.getTrendData(url, undefined, undefined, false, true);
    }

    shouldComponentUpdate(nextProps) {
        if (this.props.params === nextProps.params) {
            return true;
        }
        this.renderTrend(nextProps);
        return false;
    }

    componentWillUnmount() {
        $('body').off('keydown');
        $('body').off('keyup');
        $('body').undelegate('.selection li', 'click');
        $('body').undelegate('.area-tooltip .load-trend', 'click');
        this.setState = (state,callback)=>{
            return;
        };
    }

    // After the drag operation, the subscript of the selected data point is obtained
    getSelectedIndex(e, series) {
        let selectedIndex = [];
        series.data.forEach((item, index) => {
            if (item[0] >= e.xAxis[0].min && item[0] <= e.xAxis[0].max) {
                selectedIndex.push(index);
            }
        });
        return selectedIndex;
    }

    // Get the index of the base line
    getOriginLineIndex(me) {
        let originIndex = 0;
        for (let i = 0; i < me.series.length; i++) {
            if (me.series[i].name === 'base line') {
                originIndex = i;
                break;
            }
        }
        return originIndex;
    }

    // Gets the subscript of the selected data point
    dealSelectedIndex(me, originIndex, selectedIndex) {
        let length = selectedIndex.length;
        if (length) {
            if (length === 2) {
                if (selectedIndex[0] === 0) {
                    selectedIndex.push(1);
                }
                else if (selectedIndex[length - 1] === me.series[originIndex].points.length - 1) {
                    selectedIndex.unshift(selectedIndex[length - 1] - 2);
                }
                else {
                    selectedIndex.push(selectedIndex[length - 1] + 1);
                    selectedIndex.splice(0, 1);
                }
            }
            else {
                if (selectedIndex[0] === 0) {
                    selectedIndex.push(selectedIndex[length - 1] + 1);
                }
                else if (selectedIndex[length - 1] === me.series[originIndex].points.length - 1) {

                }
                else {
                    selectedIndex.push(selectedIndex[length - 1] + 1);
                    selectedIndex.splice(0, 1);
                }
            }
        }
        return selectedIndex;
    }

    // label data
    label(start, end, isDealSelectedIndex) {
        const self = this;
        const me = self.chart;
        let originIndex1 = 0;
        let name = self.props.params.name;
        for (let i = 0; i < me.series.length; i++) {
            if (me.series[i].name === 'base line') {
                originIndex1 = i;
                break;
            }
        }
        let selectedIndex = [];
        let points = me.series[originIndex1].points;
        points.forEach((item, index) => {
            if (item.x >= Math.round(start) && item.x <= Math.round(end)) {
                if (item.y) {
                    selectedIndex.push(index);
                }
            }
        });

        let startTime;
        let endTime;
        if (selectedIndex.length) {
            startTime = points[selectedIndex[0]].x;
            endTime = points[selectedIndex[selectedIndex.length - 1]].x;
        }
        else {
            return;
        }

        if (!window.labelObj[name]) {
            window.labelObj[name] = [];
        }
        window.labelObj[name].push([startTime, endTime]);

        let label = 1;
        window.startTime = startTime;
        window.endTime = endTime;
        let url = api.labelTrend
            + name + '/label'
            + '?startTime=' + startTime
            + '&endTime=' + endTime
            + '&label=' + label;
        axiosInstance.put(url).then(function (response) {
            self.redrawTrend(self.min, self.max);
        });
    }

    // cancel data
    cancelLabel(start, end) {
        const self = this;
        const me = self.chart;
        let name = self.props.params.name;
        let unselectedIndex = [];
        let originIndex = 0;

        for (let i = 0; i < me.series.length; i++) {
            if (me.series[i].name === 'base line') {
                originIndex = i;
            }
        }

        let points = me.series[originIndex].points;
        points.forEach((item, index) => {
            if (item.x >= Math.round(start) && item.x <= Math.round(end)) {
                if (item.y) {
                    unselectedIndex.push(index);
                }
            }
        });

        let startTime = 0;
        let endTime = 0;

        if (unselectedIndex.length) {
            startTime = points[unselectedIndex[0]].x;
            endTime = points[unselectedIndex[unselectedIndex.length - 1]].x;
        }
        else {
            return;
        }
        if (!window.labelObj[name]) {
            window.labelObj[name] = [];
        }
        let min = startTime;
        let max = endTime;
        let tempStart;
        let tempEnd;
        for (let i = 0; i < window.labelObj[name].length; i++) {
            tempStart = window.labelObj[name][i][0];
            tempEnd = window.labelObj[name][i][1];
            if (min < tempStart && max > tempEnd) {
                window.labelObj[name].splice(i, 1);
            }
            else if (min < tempStart && max > tempStart && max > tempEnd) {
                window.labelObj[name].splice(i, 1);
                window.labelObj[name].push([max, tempEnd]);
            }
            else if (min < tempEnd && min > tempStart && max > tempEnd) {
                window.labelObj[name].splice(i, 1);
                window.labelObj[name].push([tempStart, min]);
            }
            else if (min > tempStart &&  max < tempEnd) {
                window.labelObj[name].splice(i, 1);
                window.labelObj[name].push([tempStart, min]);
                window.labelObj[name].push([max, tempEnd]);
            }
            else if (min < tempStart && max === tempStart) {

            }
            else if (min === tempEnd && max > tempEnd) {

            }
            else if (min < tempStart && max === tempEnd) {
                window.labelObj[name].splice(i, 1);
            }
            else if (min === tempStart && max > tempEnd) {
                window.labelObj[name].splice(i, 1);
            }
            else if (min === tempStart && max === tempEnd) {
                window.labelObj[name].splice(i, 1);
            }
        }

        let label = 0;
        window.startTime = startTime;
        window.endTime = endTime;
        let url = api.labelTrend
            + name + '/label'
            + '?startTime=' + startTime
            + '&endTime=' + endTime
            + '&label=' + label;
        axiosInstance.put(url).then(function (response) {
            self.redrawTrend(self.min, self.max);
        });

        key.currentKey = null;
    }

    // Get the configuration of the trend graph
    getConfig(props) {
        const self = this;
        let bandName;
        let config = Object.assign({}, self.props.params);
        if (props) {
            config = Object.assign(config, props.params);
        }
        let name = config.name;
        let start;
        let end;
        let list;
        if (props && props.params) {
            list = props.params.list;
        }
        if (!list || !list.length) {
            return;
        }
        list.forEach(item => {
            if (item.name === name) {
                start = item.display.start;
                end = item.display.end;
                return;
            }
        });
        if (start === undefined || end === undefined) {
            return;
        }
        let url = api.getTrend
            + name
            + '/curves?'
            + 'startTime=' + start
            + '&endTime=' + end;
        self.min = start;
        self.max = end;
        if (bandName) {
            url += '&bandName=' + bandName;
        }
        let menuList = self.state.menuList;
        let container = 'container';
        let title = self.state.title;
        let thumb = [];
        let thumbUrl = self.state.thumbUrl + name + '/thumb';
        let menuDisplay = self.props.menuDisplay;
        let max = self.state.max;
        let min = self.state.min;
        // The trend graph is loaded after the completion of the operation
        let loadFunction = function () {
            let chart = this;
            if (chart.series.length) {
                chart.series.forEach((item, i) => {
                    if (item.name === 'base line') {
                        self.allSeriesPoints = chart.series[i].points;
                        self.abnormalSelectedPoints = [];
                        if (self.min && self.max) {
                            chart.xAxis[0].setExtremes(self.min, self.max, false);
                        }
                    }
                });
            }
        };
        // Drag and drop to select the trend data point operation
        let selectionFunction = function (e) {
            e.preventDefault();
            let me = this;
            if (key.currentKey === 32) {
                cancelLabel(me, e);
            }
            else {
                label(me, e);
            }
            return false;
        };
        // cancel label operation
        let cancelLabel = function (me, e) {
            self.cancelLabel(e.xAxis[0].min, e.xAxis[0].max);
        };
        // label operation
        let label = function (me, e) {
            self.label(e.xAxis[0].min, e.xAxis[0].max);
        };
        // Drag the small slider of the scrollbar to operate
        let afterSetExtremesFunction =  function (e) {
            e.preventDefault();
            self.afterSetExtremes.call(self, e);
        };
        // tooltipFormatter
        // In two ways:
        // First: band, ie area, display tooltip;
        // Second: label line, display operation menu; base line does not display the operation menu;
        let tooltipFormatterFunction = function (e) {
            const me = this;
            const points = me.points;
            if (!points.length) {
                return;
            }
            // return  this.x + ' ' + this.y;
            let tooltip = '';
            for (let k = 0; k < points.length; k ++) {
                let name = points[k].series.name;
                let type = points[k].series.userOptions.type;
                if (type === 'area') {
                    for (let i = 0; i < self.state.bands.length; i++) {
                        let band = self.state.bands[i];
                        if (band.name === name) {
                            for (let j = 0; j < band.bands.length; j++) {
                                let currentBand = band.bands[j];
                                if (currentBand.currentTime.duration.start <= me.x
                                    && currentBand.currentTime.duration.end >= me.x) {
                                    tooltip = self.labelTooltip(currentBand.bandNo, currentBand.bandCount,
                                        currentBand.preTime, currentBand.nextTime, currentBand.currentTime, name, me.x);
                                    break;
                                }
                            }
                        }
                    }
                }
                else {
                    let menuList = '';
                    let name = points[k].series.name;
                    if (name === 'label line' && points[k].color === 'red') {
                        if (self.state.menuList.length) {
                            menuList += '<ul class="selection">';
                            for (let i = 0; i < self.state.menuList.length; i++) {
                                menuList += ''
                                    + '<li style="cursor: pointer;" data-action="'
                                    + self.state.menuList[i].action
                                    + '" data-currentx="'
                                    + me.x
                                    + '">'
                                    + self.state.menuList[i].name
                                    + '</li>';
                            }
                            menuList += '</ul>';
                        }
                        else {
                            menuList = '';
                        }
                        tooltip = menuList;
                    }
                    else if (name === 'base line') {
                        tooltip = '';
                    }
                }
            }
            if (tooltip.length) {
                return tooltip;
            }
            else {
                return false;
            }
        };
        // let mouseOverFunction = function (e) {
        //     window.currentOperaPoint = e;
        //     window.chartTrend = e.target.series.chart;
        //     window.currentIndex = e.target.index;
        //     window.currentX = e.target.x;
        // };
        // The configuration parameters required for the trend graph
        let options = {
            lang: {
                noData: 'No data found in the uploaded file, please check.'
            },
            colors: ['#7cb5ec', '#80699B', '#90ed7d', '#f7a35c', '#8085e9',
                '#f15c80', '#e4d354', '#8085e8', '#8d4653', '#91e8e1'],
            noData: {
                style: {
                    fontWeight: 'normal',
                    fontSize: '12px',
                    color: '#ccc'
                }
            },
            chart: {
                height: 500,
                zoomType: 'x',
                events: {
                    load: loadFunction,
                    selection: selectionFunction
                }
                // ,
                // animation: {
                //     duration: 0
                // }
                // animation: false
            },
            title: {
                text: '',
                style: {
                    fontSize: '16px'
                }
            },
            scrollbar: {
                enabled: true,
                height: 0,
                buttonArrowColor: 'transparent',
                liveRedraw: false
            },
            navigator: {
                adaptToUpdatedData: false,
                enabled: true,
                maskFill: 'rgba(56,143,247,0.3)',
                height: 60,
                outlineWidth: 0,
                series: {
                    data: thumb,
                    type: 'line',
                    color: '#388FF7',
                    fillOpacity: 0,
                    dataGrouping: {
                        smoothed: true
                    },
                    lineWidth: 1,
                    lineColor: '#388FF7',
                    marker: {
                        enabled: false
                    },
                    name: 'sample demo'
                },
                type: 'datetime',
                dateTimeLabelFormats: {
                    second: '%Y-%m-%d<br/>%H:%M:%S',
                    minute: '%Y-%m-%d<br/>%H:%M',
                    hour: '%Y-%m-%d<br/>%H:%M',
                    day: '%Y<br/>%m-%d',
                    week: '%Y<br/>%m-%d',
                    month: '%Y-%m',
                    year: '%Y'
                },
                animation: false
            },
            rangeSelector: {
                buttons: [{
                    type: 'second',
                    count: 3600,
                    text: '1h'
                }, {
                    type: 'second',
                    count: 21600,
                    text: '6h'
                }, {
                    type: 'second',
                    count: 43200,
                    text: '12h',
                    dataGrouping: {
                        units: [
                            ['second', [1]]
                        ]
                    }
                }, {
                    type: 'second',
                    count: 86400,
                    text: '1d',
                    dataGrouping: {
                        units: [
                            ['second', [1]]
                        ]
                    }
                }, {
                    type: 'second',
                    count: 259200,
                    text: '3d',
                    dataGrouping: {
                        units: [
                            ['second', [1]]
                        ]
                    }
                }, {
                    type: 'second',
                    count: 604800,
                    text: '7d',
                    dataGrouping: {
                        units: [
                            ['second', [1]]
                        ]
                    }
                }, {
                    type: 'second',
                    count: 1209600,
                    text: '14d',
                    dataGrouping: {
                        units: [
                            ['second', [1]]
                        ]
                    }
                }, {
                    type: 'all',
                    text: 'All'
                }],
                inputEnabled: false,
                buttonPosition: {
                    x: -5
                },
                buttonSpacing: 10,
                buttonTheme: {
                    // styles for the buttons
                    'fill': 'none',
                    'stroke-width': 1,
                    'r': 1,
                    'style': {
                        color: '#aaa',
                        textShadow: 'none'
                    },
                    'states': {
                        hover: {
                            fill: '#388ff7',
                            style: {
                                color: 'white',
                                cursor: 'pointer',
                                textShadow: 'none'
                            }
                        },
                        select: {
                            fill: '#388ff7',
                            style: {
                                color: 'white',
                                textShadow: 'none'
                            }
                        }
                    }
                },
                labelStyle: {
                    display: 'none'
                }
            },
            tooltip: {
                shared: false,
                enabled: true,
                backgroundColor: '#fff',
                borderRadius: 1,
                borderWidth: 0,
                shadow: true,
                animation: true,
                style: {
                    fontSize: '12px',
                    pointerEvents: 'auto'
                },
                useHTML: true,
                formatter: tooltipFormatterFunction,
                hideDelay: 5000
            },
            xAxis: {
                crosshair: false,
                events: {
                    afterSetExtremes: afterSetExtremesFunction
                },
                type: 'datetime',
                dateTimeLabelFormats: {
                    second: '%Y-%m-%d<br/>%H:%M:%S',
                    minute: '%Y-%m-%d<br/>%H:%M',
                    hour: '%Y-%m-%d<br/>%H:%M',
                    day: '%Y<br/>%m-%d',
                    week: '%Y<br/>%m-%d',
                    month: '%Y-%m',
                    year: '%Y'
                },
                categories: []
            },
            yAxis: {
                max: max,
                min: min,
                opposite: false,
                startOnTick: false
            },
            legend: {
                enabled: false,
                symbolRadius: 0,
                symbolWidth: 25,
                squareSymbol: false,
                align: 'right',
                backgroundColor: '#fff',
                borderWidth: 0,
                layout: 'vertical',
                verticalAlign: 'top',
                y: 20,
                x: 20,
                width: 150,
                itemMarginTop: 5,
                itemMarginBottom: 10
            },
            plotOptions: {
                line: {
                    // boostThreshold: 200,
                    marker: {
                        states: {
                            hover: {
                                enabled: true
                            }
                        }
                    },
                    point: {
                        events: {}
                    },
                    tooltip: {
                        hideDelay: 5000
                    },
                    turboThreshold: 3000
                },
                area: {
                    point: {
                        events: {}
                    },
                    animation: false,
                    trackByArea: true,
                    connectNulls: false
                },
                series: {
                    stickyTracking: false,
                    turboThreshold: 3000,
                    marker: {
                        states: {
                            hover: {
                                enabled: true
                            }
                        }
                    },
                    states: {
                        hover: {
                            enabled: false
                        }
                    },
                    events: {
                    }
                    ,
                    // point: {
                    //     events: {
                    //         mouseOver: mouseOverFunction
                    //     }
                    // },
                    animation: false
                }
            }
        };
        let init = self.state.init;
        let params = {
            bandName: bandName,
            title: title,
            dataName: name,
            startTime: start,
            endTime: end,
            url: url,
            name: name,
            thumbUrl: thumbUrl,
            options: options,
            menuDisplay: menuDisplay,
            menuList: menuList,
            init: init,
            container: container
        };
        self.setState({
            options
        });
        return params;
    }

    // Rendering trend graphs, including trend graphs and thumbnails
    renderTrend(props) {
        let options = this.getConfig(props);
        if (!options) {
            return;
        }
        this.getTrendData(options.url, options.options, undefined, false);
        this.getThumbTrendData(options.thumbUrl, options.options);
    }

    // Get the operation menu for the label line
    getOperaMenuData() {
        const self = this;
        let menuListUrl = api.getTooltipMenu;
        axiosInstance.get(menuListUrl).then(function (response) {
            const data = response.data;
            self.setState({
                menuList: data.data
            });
        });
    }

    // Rendering thumbnails trend graph
    getThumbTrendData(thumbUrl, options) {
        const self = this;
        axiosInstance.get(thumbUrl).then(function (response) {
            const data = response.data;
            if (data.msg === 'redirect' && data.data.length) {
                hashHistory.push(data.data);
                return;
            }
            let result = data.data.data;
            options.navigator.series.data = result;
            self.setState({
                container: options.container,
                options: options,
                type: 'stockChart'
            });
            self.getAllTime(result);
            window.thumbExtremes[self.props.params.name] = {
                max: result[result.length - 1][0],
                min: result[0][0]
            };
        });
    }

    // Get the width of the big trend graph
    getTrendWidth() {
        let width = 0;
        if (this.state.bandMenuStyle) {
            width = document.body.clientWidth - 150 - 35;
        }
        else {
            width = document.body.clientWidth - 40 - 35;
        }
        if (this.props.params.menuDisplay === 'block') {
            width = width - 200;
        }
        return width;
    }

    // Rendering trend graph
    getTrendData(url, options, setExtremes, reflowThumb, setData) {
        const self = this;
        if (!options) {
            options = self.state.options;
        }
        let listUrl = api.getDataList;
        if (self.chart) {
            self.chart.showLoading('Data is loading, please wait...');
            self.chart.xAxis[0].setExtremes(self.min, self.max, false);
        }
        if (!self.state.datasInit) {
            axiosInstance.get(listUrl).then(function (response) {
                const data = response.data;
                if (data.msg === 'redirect' && data.data.length) {
                    hashHistory.push(data.data);
                    return;
                }
                if (self.chart) {
                    self.chart.xAxis[0].setExtremes(self.min, self.max, false);
                }
                self.setState({
                    list: data.data,
                    datasInit: false
                });
            });
        }
        axiosInstance.get(url).then(function (response) {
            const data = response.data;
            if (data.msg === 'redirect' && data.data.length) {
                hashHistory.push(data.data);
                return;
            }
            if (self.chart) {
                self.chart.xAxis[0].setExtremes(self.min, self.max, false);
            }
            let bands = data.data.bands;
            let trends = data.data.trends;
            let trendsBands = [];
            let trendsTrends = [];
            let name = self.props.params.name;
            trends.forEach((item, index) => {
                if (item.type === 'arearange') {
                    self.optionAreaRange(item);
                    trendsTrends.push(item);
                }
                if (item.type === 'line' || !item.type) {
                    if (item.name === 'base line') {
                        self.optionBaseLine(item);
                    } else if (item.name === 'label line') {
                        self.optionLabelLine(item);
                    } else {
                        self.optionLine(item, index);
                    }
                    trendsTrends.push(item);
                }
                if (item.type === 'area') {
                    self.optionArea(item);
                    item.visible = false;
                    trendsBands.push(item);
                }
            });
            options.yAxis.min = data.data.yAxis[0];
            options.yAxis.max = data.data.yAxis[1];
            options.series = trends;
            // options.rangeSelector.selected = undefined;
            options.chart.width = self.getTrendWidth();
            clearInterval(self.loadingTime);
            clearInterval(self.loadingTipTime);
            clearInterval(self.loadingTrendTipTime);
            if (self.refs.loadingContainer) {
                self.refs.loadingContainer.innerHTML = '';
            }
            if (self.refs.loadingTip) {
                self.refs.loadingTip.style.display = 'none';
            }
            let paramsOptions = {
                title: name,
                series: trends,
                trendSeries: trendsTrends,
                bandSeries: trendsBands,
                bands: bands,
                container: options.container,
                options: options,
                type: 'stockChart',
                loading: false,
                neverReflow: reflowThumb
            };
            if (setData) {
                //setdata
                trends.forEach((trendItem, trendIndex) => {
                    self.chart.series.forEach((seriesItem, seriesIndex) => {
                        if (self.chart.series[seriesIndex].name === trendItem.name) {
                            self.chart.series[seriesIndex].setData(trendItem.data);
                            return;
                        }
                    });
                });
            }
            else {
                // redraw trend
                self.setState(paramsOptions);
            }
            eventProxy.trigger('loadBand', {
                name,
                trendsBands
            });
            self.chart.hideLoading();
            eventProxy.trigger('loadTrend', {
                list: name
            });
        }, function (err) {
            eventProxy.trigger('openDialog', {
                title: 'Note',
                content: err.message,
                name: '',
                type: 'alert',
                callback: function () {
                    if (self.chart) {
                        self.chart.hideLoading();
                    }
                }
            });
        });
    }

    returnBands(bands) {
        this.setState({
            bands
        });
    }

    returnBandContent(bands) {
        this.setState({
            bandContent: bands
        });
    }

    optionAreaRange(item) {
        item.lineWidth = 0;
        item.color = 'rgb(240,255,240)';
        item.zIndex = 0;
        item.enableMouseTracking = false;
        item.showInLegend = true;
        item.dataGrouping = {
            enabled: false
        };
    }

    optionBaseLine(item) {
        item.zIndex = 99;
        item.lineWidth = 2;
        item.color = '#388FF7';
        item.dataGrouping = {
            enabled: false
        };
        this.baseLine = item.data;
    }

    optionLabelLine(item) {
        item.showInLegend = false;
        item.lineWidth = 2;
        item.zIndex = 100;
        item.enableMouseTracking = true;
        item.zoneAxis = 'x';
        item.dataGrouping = {
            enabled: false
        };
        item.color = 'red';
    }

    optionArea(item) {
        item.lineWidth = 0;
        item.fillOpacity = 0.3;
        item.zIndex = 1;
        item.enableMouseTracking = true;
        item.dataGrouping = {
            enabled: false
        };
    }

    optionLine(item, index) {
        let colors = this.state.options.colors;
        item.showInLegend = false;
        item.lineWidth = 2;
        item.zIndex = 2 + index;
        item.enableMouseTracking = true;
        item.dataGrouping = {
            enabled: false
        };
        item.color = colors[index % colors.length];
    }

    labelTooltip(current, total, pre, next, currentTime, bandName, x) {
        let tooltip = '';
        let preStartTime = pre ? pre.start : '';
        let preEndTime = pre ? pre.start : '';
        let nextStartTime = next ? next.start : '';
        let nextEndTime = next ? next.end : '';
        tooltip += '<div class="area-tooltip">'
            + '<div class="area-tooltip-content">'
            + '<p class="label-opera label" '
            + 'style="cursor: pointer; color: #388ff7;" '
            + 'data-current-start-time="'
            + currentTime.duration.start
            + '" data-current-end-time="'
            + currentTime.duration.end
            + '">Label</p>';
        // eg. 1/1
        if (current === total && current === 1) {
            tooltip += '<div class="num-tooltip">'
                + '<span class="current-tooltip">'
                + current
                + '</span>'
                + '/'
                + '<span class="total-tooltip">'
                + total
                + '</span>'
                + '</div>';
        }
        // eg. 1/6
        else if (current < total && current === 1) {
            tooltip += '<div class="num-tooltip">'
                + '<span class="current-tooltip">'
                + current
                + '</span>'
                + '/'
                + '<span class="total-tooltip">'
                + total
                + '</span>'
                + '<i class="anticon anticon-caret-right load-trend"'
                + ' style="cursor: pointer; color: #388ff7" '
                + 'data-action="right" data-next-start-time="'
                + nextStartTime
                + '" data-next-end-time="'
                + nextEndTime
                + '" data-band-name="'
                + bandName
                + '"></i>'
                + '</div>';
        }
        // eg. 6/6
        else if (current === total && current !== 1) {
            tooltip += '<div class="num-tooltip">'
                + '<i class="anticon anticon-caret-left load-trend"'
                + 'style="cursor: pointer; color: #388ff7" '
                + 'data-action="left" data-pre-start-time="'
                + preStartTime
                + '" data-pre-end-time="'
                + preEndTime
                + '" data-band-name="'
                + bandName
                + '"></i>'
                + '<span class="current-tooltip">'
                + current
                + '</span>'
                + '/'
                + '<span class="total-tooltip">'
                + total
                + '</span>'
                + '</div>';
        }
        else {
            tooltip += '<div class="num-tooltip">'
                + '<i class="anticon anticon-caret-left load-trend"'
                + 'style="cursor: pointer; color: #388ff7" '
                + 'data-action="left" data-pre-start-time="'
                + preStartTime
                + '" data-pre-end-time="'
                + preEndTime
                + '" data-band-name="'
                + bandName
                + '"></i>'
                + '<span class="current-tooltip">'
                + current
                + '</span>'
                + '/'
                + '<span class="total-tooltip">'
                + total
                + '</span>'
                + '<i class="anticon anticon-caret-right load-trend"'
                + ' style="cursor: pointer; color: #388ff7" '
                + 'data-action="right" data-next-start-time="'
                + nextStartTime
                + '" data-next-end-time="'
                + nextEndTime
                + '" data-band-name="'
                + bandName
                + '"></i>'
                + '</div>';
        }
        tooltip += '</div></div>';
        return tooltip;
    }

    afterSetExtremes(e) {
        const self = this;
        let trigger = ['navigator', 'rangeSelectorButton'];
        let option;
        let startTime;
        let endTime;
        // Set the extreme value to avoid the big picture redrawing before the request
        if (e.target.chart) {
            e.target.chart.showLoading('Data is loading, please wait...');
        }
        if (e.trigger) {
            let extraMin = window.thumbExtremes[self.props.params.name].min;
            let extraMax = window.thumbExtremes[self.props.params.name].max;
            if (trigger.indexOf(e.trigger) === -1) {
                return;
            }
            if (e.trigger === 'rangeSelectorButton') {
                option = self.state.options;
                let diff = 0;
                let selectedButtons = option.rangeSelector.buttons;
                let currentSelectedText  = e.rangeSelectorButton.text;
                selectedButtons.forEach((item, index) => {
                    if (item.text === currentSelectedText) {
                        option.rangeSelector.selected = index;
                        if (index <= 6) {
                            diff = item.count * 1000;
                        }
                        else {
                            diff = 0;
                        }
                        return;
                    }
                });
                endTime = self.max;
                startTime = self.max - diff;
                if (diff === 0) {
                    startTime = extraMin;
                    endTime = extraMax;
                }
                else {
                    if (startTime < extraMin) {
                        startTime = extraMin;
                        endTime = extraMin + diff;
                        if (endTime > extraMax) {
                            endTime = extraMax;
                        }
                    }
                }
            }
            else {
                option = self.state.options;
                let hour = Math.round(e.userMax) - Math.round(e.userMin) / 1000 / 60 / 60;
                let day = hour / 24;
                let hourIndex = [1, 6, 12].indexOf(hour) || 0;
                let dayIndex = [1, 3, 7, 14].indexOf(day) || 0;
                if (hourIndex !== -1) {
                    option.rangeSelector.selected = hourIndex;
                }
                else if (dayIndex !== -1) {
                    option.rangeSelector.selected = 3 + dayIndex;
                }
                else {
                    option.rangeSelector.selected = undefined;
                }
                startTime = Math.round(e.userMin);
                endTime = Math.round(e.userMax);
                if (startTime < extraMin) {
                    startTime = extraMin;
                }
                if (endTime > extraMax) {
                    endTime = extraMax;
                }
                startTime = self.getTime(startTime);
                endTime = self.getTime(endTime);
            }
            self.min = startTime;
            self.max = endTime;
            let url = api.getTrend
                + self.props.params.name
                + '/curves?'
                + 'startTime=' + startTime
                + '&endTime=' + endTime;
            self.getTrendData(url, option, true, false, true);
        }
        else {
            if (e.target.chart) {
                e.target.chart.hideLoading();
            }
        }
    }

    getAllTime(data) {
        let self = this;
        let result = data.map(item => {
            return item[0];
        });
        self.allTime = result;
    }

    getTime(time) {
        let resultTime;
        for (let i = 0; i < this.allTime.length - 1; i ++) {
            if (this.allTime[i] <= time && this.allTime[i + 1] >= time) {
                if (time - this.allTime[i] >= this.allTime[i + 1] - time) {
                    resultTime = this.allTime[i + 1];
                }
                else {
                    resultTime = this.allTime[i];
                }
                break;
            }
        }
        return resultTime;
    }

    returnMenuList(menuList) {
        if (menuList.length) {
            this.setState({
                menuList
            });
        }
    }

    renderSummary(dataList) {
        const self = this;
        let name = self.props.params.name;
        let list = dataList && dataList.length ? dataList : self.props.params.list;
        let summary;
        if (!list || !list.length) {
            return;
        }
        list.forEach(item => {
            if (item.name === name) {
                summary = item;
                return;
            }
        });
        if (summary === undefined) {
            return;
        }
        let period = moment(summary.time.start).format('YYYY-MM-DD HH:mm:ss')
            + '~' + moment(summary.time.end).format('YYYY-MM-DD HH:mm:ss');
        let length;
        if ((summary.period.ratio * 100 + '').split('.').length > 1) {
            length = 'Interval: '
                + summary.period.length + 's'
                + ' (' + (summary.period.ratio * 100 + '').split('.')[0]
                + '.'
                + (summary.period.ratio * 100 + '').split('.')[1].substring(0, 4) + ')%';
        }
        else {
            length = 'Interval: '
                + summary.period.length + 's'
                + ' (' + (summary.period.ratio * 100 + '').split('.')[0]
                + '.'
                + '00)%';
        }
        let labelRatio;
        if ((summary.labelRatio * 100 + '').split('.').length > 1) {
            labelRatio = (summary.labelRatio * 100 + '').split('.')[0]
                + '.'
                + (summary.labelRatio * 100 + '').split('.')[1].substring(0, 4) + '%';
        }
        else {
            labelRatio = (summary.labelRatio * 100 + '').split('.')[0]
                + '.'
                + '00%';
        }
        return (
            <p>
                <span className="title">{name}</span>
                <span className="brief">
                    <i>{period}</i>
                    <i>{length}</i>
                    <i>Anomaly percent: {labelRatio}</i>
                </span>
            </p>
        );
    }

    returnDataList(dataList) {
        eventProxy.trigger('refreshDataList', dataList);
    }

    returnChart(chart) {
        this.chart = chart;
    }

    returnBandStyle(bandStyle) {
        this.setState({
            bandMenuStyle: bandStyle.bandMenuStyle,
            smallBandMenuStyle: bandStyle.smallBandMenuStyle
        });
    }

    render() {
        let text = 'The trend is loading, please wait';
        if (this.props.params.list.length) {
            if (this.state.loading) {
                return (
                    <div className="loading-trend" ref="loadingContainer">The trend is loading, please wait</div>
                );
            }
            else {
                let options = this.state.options;
                if (options.chart) {
                    options.chart.width = this.getTrendWidth();
                }
                let list = this.state.list;
                return (
                    <div>
                        <div className="trend">
                            <h3 className="summary">
                                {this.renderSummary(list)}
                            </h3>
                            <Band series={this.state.series}
                                  trendSeries={this.state.trendSeries}
                                  bandSeries={this.state.bandSeries}
                                  chart={this.refs.container}
                                  returnBandStyle={bandStyle => this.returnBandStyle(bandStyle)}
                                  init={this.state.init}
                                  list={this.props.params.list}
                                  name={this.props.params.name}
                            >
                            </Band>
                            <Chart ref="container"
                                   container={this.state.container}
                                   config={options}
                                   type={this.state.type}
                                   returnChart = {chart => this.returnChart(chart)}
                                   neverReflow={this.state.neverReflow}
                            />
                            <div ref="loadingTip" className="loading-tip">{text}</div>
                        </div>
                    </div>
                );
            }
        }
        else {
            return (
                <div className="trend no-data-list">
                    <div>
                        <img src={img} alt="no data" className="no-data-list-img"/>
                        <div className="no-data-list-tip">There is no data, yet</div>
                        <UploadData returnDataList={dataList => this.returnDataList(dataList)}
                                    type="trend"
                        ></UploadData>
                    </div>
                    <div ref="loadingTip" className="loading-tip">{text}</div>
                </div>
            );
        }
    }
}

