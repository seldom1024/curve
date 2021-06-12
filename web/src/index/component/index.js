/**
 * @file response
 * @author cuiyuan
 */

import './index.less';
import './MFTable.less';

import React, {Component} from 'react';
import {Layout, Icon, Button} from 'antd';
import Sidebar from './sidebar';
import Trend from './trend';
import eventProxy from '../../tools/eventProxy';
import guidePage from '../../common/image/guide-page.png';

const {Sider, Content} = Layout;

export default class Home extends Component {
    constructor(props) {
        super(props);
        this.state = {
            dataList: [],
            name: '',
            data: [],
            menuDisplay: 'block',
            foldMenu: 'block',
            unFoldMenu: 'none',
            list: [],
            overlayDisplay: 'none',
            dialogTitle: '',
            dialogContent: '',
            overlayBlack: 'none'
        };
    }

    componentDidMount() {
        eventProxy.on('loadTrend', obj => {
            if (this && this.refs && this.hotKey) {
                this.refs.hotKey.style.display = 'block';
            }
            if (typeof obj.list === 'string') {
                return;
            }
            this.setState({
                list: obj.list
            });
        });
    }

    returnSummary(name, list) {
        this.setState({
            name,
            list
        });
    }

    toggleMenu(type) {
        if (type === 'fold') {
            this.setState({
                menuDisplay: 'none',
                foldMenu: 'none',
                unFoldMenu: 'block'
            });
        }
        else if (type === 'unfold') {
            this.setState({
                menuDisplay: 'block',
                foldMenu: 'block',
                unFoldMenu: 'none'
            });
        }
        eventProxy.trigger('loadingTip', 'Redrawing graphics, please wait');
    }

    hideSummary() {
        eventProxy.trigger('hideSummary', this.refs.overlay);
        this.refs.overlay.style.display = 'none';
    }

    returnShowOverlay(show) {
        if (this.state.overlayDisplay !== show) {
            this.setState({
                overlayDisplay: show ? 'block' : 'none'
            });
        }
    }

    showGuidance() {
        this.refs.guidance.style.display = 'block';
    }

    hideGuidance() {
        this.refs.guidance.style.display = 'none';
    }

    showItem(url) {
        let name = url ? url.split('/')[2] : this.props.params.name;
        if (name === 'table') {
            this.setState({
                table: 'block',
                trend: 'none'
            });
        }
        else {
            this.setState({
                table: 'none',
                trend: 'block'
            });
        }
    }

    render() {
        let params = {
            name: this.props.params.name,
            list: this.state.list,
            menuDisplay: this.state.menuDisplay
        } || {};
        let overlayDisplay = this.state.overlayDisplay;
        return (
            <Layout>
                <Sider className="index-sidebar"
                       style={{display: this.state.menuDisplay, position: 'static'}}
                >
                    <Sidebar returnSummary={(name, list) => this.returnSummary(name, list)}
                             hideSummary={this.state.hideSummary}
                             returnShowOverlay={show => this.returnShowOverlay(show)}
                             params={params}
                             overlay={this.refs.overlay}
                             list={this.state.list}
                             type={this.state.type}
                             ref="sidebar"
                             showItem={this.showItem.bind(this)}
                             showAll={true}
                    >
                    </Sidebar>
                </Sider>
                <Icon type="menu-fold"
                      className="menu-fold"
                      onClick={this.toggleMenu.bind(this, 'fold')}
                      style={{display: this.state.foldMenu}}
                />
                <Icon type="menu-unfold"
                      className="menu-unfold"
                      onClick={this.toggleMenu.bind(this, 'unfold')}
                      style={{display: this.state.unFoldMenu}}
                />
                <button className="hot-key" onClick={this.showGuidance.bind(this)} ref="hotKey">Help</button>
                <Content className="index-con">
                    <Trend
                        params={params}
                    >
                    </Trend>
                </Content>
                <div className="overlay"
                     onClick={this.hideSummary.bind(this)}
                     style={{display: overlayDisplay}}
                     ref="overlay"
                ></div>
                <div className="guidance" ref="guidance">
                    <img className="guide-page" src={guidePage} alt="guide page"/>
                    <Button className="close" onClick={this.hideGuidance.bind(this)}>Close</Button>
                </div>
            </Layout>
		);
    }
}
