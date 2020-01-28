import React, { useState, useContext, useEffect } from 'react';
import { ReactComponent as DownChevron } from './../../../../../images/Common/down-chevron.svg';
import {
  chevronIconStyle,
  logCommandBarStyle,
  logExpandButtonStyle,
  logStreamStyle,
  logCommandBarButtonListStyle,
  logCommandBarButtonLabelStyle,
  logCommandBarButtonStyle,
  logEntryDivStyle,
  getLogTextColor,
  logErrorDivStyle,
  logConnectingDivStyle,
} from './FunctionLog.styles';
import { useTranslation } from 'react-i18next';
import { Icon } from 'office-ui-fabric-react';
import { ThemeContext } from '../../../../../ThemeContext';
import { QuickPulseQueryLayer, SchemaResponseV2, SchemaDocument } from '../../../../../QuickPulseQuery';
import { CommonConstants } from '../../../../../utils/CommonConstants';
import { defaultDocumentStreams, defaultClient } from './FunctionLog.constants';
import LogService from '../../../../../utils/LogService';
import { LogCategories } from '../../../../../utils/LogCategories';
import { TextUtilitiesService } from '../../../../../utils/textUtilities';
interface FunctionLogProps {
  toggleExpand: () => void;
  toggleFullscreen: (fullscreen: boolean) => void;
  isExpanded: boolean;
  fileSavedCount: number;
  resetAppInsightsToken: () => void;
  appInsightsToken?: string;
}

const FunctionLog: React.FC<FunctionLogProps> = props => {
  const { t } = useTranslation();
  const { toggleExpand, isExpanded, toggleFullscreen, appInsightsToken, fileSavedCount, resetAppInsightsToken } = props;
  const [maximized, setMaximized] = useState(false);
  const [started, setStarted] = useState(false);
  const [queryLayer, setQueryLayer] = useState<QuickPulseQueryLayer | undefined>(undefined);
  const [logEntries, setLogEntries] = useState<SchemaDocument[]>([]);
  const [callCount, setCallCount] = useState(0);
  const [appInsightsError, setAppInsightsError] = useState(false);

  const theme = useContext(ThemeContext);

  const queryAppInsightsAndUpdateLogs = (quickPulseQueryLayer: QuickPulseQueryLayer, token: string) => {
    quickPulseQueryLayer
      .queryDetails(token, false, '')
      .then((dataV2: SchemaResponseV2) => {
        if (dataV2.DataRanges && dataV2.DataRanges[0] && dataV2.DataRanges[0].Documents) {
          let documents = dataV2.DataRanges[0].Documents;
          if (callCount === 0) {
            documents = trimPreviousLogs(documents);
          }
          setLogEntries(logEntries.concat(documents));
        }
      })
      .catch(error => {
        resetAppInsightsToken();
        LogService.error(
          LogCategories.FunctionEdit,
          'getAppInsightsComponentToken',
          `Error when attempting to Query Application Insights: ${error}`
        );
      })
      .finally(() => {
        setCallCount(callCount + 1);
      });
  };

  const trimPreviousLogs = (documents: SchemaDocument[]) => {
    if (documents.length > 100) {
      return documents.slice(0, 100).reverse();
    }
    return documents.reverse();
  };

  const formatLog = (logEntry: SchemaDocument) => {
    return `${logEntry.Timestamp}   [${logEntry.Content.SeverityLevel}]   ${logEntry.Content.Message}`;
  };

  const disconnectQueryLayer = () => {
    setQueryLayer(undefined);
  };

  const reconnectQueryLayer = () => {
    const newQueryLayer = new QuickPulseQueryLayer(CommonConstants.QuickPulseEndpoints.public, defaultClient);
    newQueryLayer.setConfiguration([], defaultDocumentStreams, []);
    setQueryLayer(newQueryLayer);
    setCallCount(0);
  };

  const onExpandClick = () => {
    if (isExpanded && maximized) {
      toggleMaximize();
    }
    toggleExpand();
  };

  const toggleConnection = () => {
    if (started) {
      stopLogs();
    } else {
      startLogs();
    }
  };

  const startLogs = () => {
    if (appInsightsToken) {
      disconnectQueryLayer();
      reconnectQueryLayer();
    } else {
      setAppInsightsError(true);
    }
    setStarted(true);
  };

  const stopLogs = () => {
    disconnectQueryLayer();
    setStarted(false);
  };

  const clearLogs = () => {
    setLogEntries([]);
  };

  const copyLogs = () => {
    const logContent = logEntries.map(logEntry => formatLog(logEntry)).join('\n');
    TextUtilitiesService.copyContentToClipboard(logContent);
  };

  const toggleMaximize = () => {
    setMaximized(!maximized);
  };

  useEffect(() => {
    if (isExpanded) {
      startLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  useEffect(() => {
    toggleFullscreen(maximized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maximized]);

  useEffect(() => {
    if (!started && fileSavedCount > 0) {
      startLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileSavedCount]);

  useEffect(() => {
    if (appInsightsToken && queryLayer) {
      const timeout = setTimeout(() => queryAppInsightsAndUpdateLogs(queryLayer, appInsightsToken), 3000);
      return () => clearInterval(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logEntries, queryLayer, appInsightsToken, callCount]);

  return (
    <div>
      <div className={logCommandBarStyle}>
        <span className={logExpandButtonStyle} onClick={onExpandClick}>
          <DownChevron className={chevronIconStyle(!isExpanded)} />
          {t('logStreaming_logs')}
        </span>
        {isExpanded && (
          <span className={logCommandBarButtonListStyle}>
            <span onClick={toggleConnection} className={logCommandBarButtonLabelStyle}>
              {started ? (
                <>
                  <Icon iconName="Stop" className={logCommandBarButtonStyle(theme)} />
                  {t('stop')}
                </>
              ) : (
                <>
                  <Icon iconName="TriangleRight12" className={logCommandBarButtonStyle(theme)} />
                  {t('start')}
                </>
              )}
            </span>
            <span onClick={copyLogs} className={logCommandBarButtonLabelStyle}>
              <Icon iconName="Copy" className={logCommandBarButtonStyle(theme)} />
              {t('functionKeys_copy')}
            </span>
            <span onClick={clearLogs} className={logCommandBarButtonLabelStyle}>
              <Icon iconName="CalculatorMultiply" className={logCommandBarButtonStyle(theme)} />
              {t('logStreaming_clear')}
            </span>
            <span onClick={toggleMaximize} className={logCommandBarButtonLabelStyle}>
              {maximized ? (
                <>
                  <Icon iconName="BackToWindow" className={logCommandBarButtonStyle(theme)} />
                  {t('minimize')}
                </>
              ) : (
                <>
                  <Icon iconName="FullScreen" className={logCommandBarButtonStyle(theme)} />
                  {t('maximize')}
                </>
              )}
            </span>
          </span>
        )}
      </div>
      {isExpanded && (
        <div className={logStreamStyle(maximized)}>
          {/*Error Message*/}
          {appInsightsError && <div className={logErrorDivStyle}>{t('functionEditor_appInsightsNotConfigured')}</div>}

          {/*Loading Message*/}
          {started && logEntries.length === 0 && <div className={logConnectingDivStyle}>{t('functionEditor_connectingToAppInsights')}</div>}

          {/*Log Entries*/}
          {!!logEntries &&
            logEntries.map((logEntry: SchemaDocument, logIndex) => {
              return (
                <div
                  key={logIndex}
                  className={logEntryDivStyle}
                  style={{ color: getLogTextColor(logEntry.Content.SeverityLevel || '') }}
                  /*Last Log Entry needs to be scrolled into focus*/
                  ref={el => {
                    if (logIndex + 1 === logEntries.length && !!el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}>
                  {formatLog(logEntry)}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default FunctionLog;